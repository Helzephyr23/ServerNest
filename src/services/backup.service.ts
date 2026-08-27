import db from "../config/database.js";
import docker from "../config/docker.js";
import { notify } from "./notification.service.js";
import { uploadBackupToCloud, deleteFromCloud, CloudStorageConfig } from "./cloud-storage.service.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { Readable } from "stream";
import { mkdirSync, existsSync } from "fs";

interface ServerRow {
  id: number;
  name: string;
  container_id: string | null;
  node_id: number;
  port: number;
  mc_version: string;
  software: string;
  ram_mb: number;
  image: string;
  eula_accepted: boolean;
  status: string;
}

interface Backup {
  id: number;
  server_id: number;
  filename: string;
  size: number;
  checksum?: string;
  created_at: string;
}

interface BackupUpload {
  id: number;
  backup_id: number;
  storage_id: number;
  status: string;
  checksum?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

interface BackupWithUploads extends Backup {
  uploads?: (BackupUpload & { provider: string; label: string })[];
}

const BACKUP_DIR = path.resolve("./data/backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export function getBackups(serverId: number): BackupWithUploads[] {
  const backups = db.prepare("SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC").all(serverId) as BackupWithUploads[];
  for (const b of backups) {
    b.uploads = db.prepare(`
      SELECT bu.*, csc.provider, csc.label
      FROM backup_uploads bu
      JOIN cloud_storage_configs csc ON csc.id = bu.storage_id
      WHERE bu.backup_id = ?
    `).all(b.id) as (BackupUpload & { provider: string; label: string })[];
  }
  return backups;
}

export async function createBackup(serverId: number): Promise<Backup> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
  if (!server) throw new Error("Server not found");

  const containerName = `biryani-mc-${server.id}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${server.name}-${timestamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, filename);

  if (server.container_id) {
    try {
      const container = docker.getContainer(containerName);
      const exec = await container.exec({
        Cmd: ["tar", "cf", "-", "-C", "/data", "."],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false });
      const writeStream = createWriteStream(backupPath);
      const gzip = createGzip();
      const stdoutStream = new Readable({
        read() {},
      });
      let buf = Buffer.alloc(0);
      stream.on("data", (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 8) {
          const type = buf[0];
          const size = buf.readUInt32BE(4);
          if (buf.length < 8 + size) break;
          const data = buf.subarray(8, 8 + size);
          buf = buf.subarray(8 + size);
          if (type === 1) stdoutStream.push(data);
        }
      });
      stream.on("end", () => stdoutStream.push(null));
      await pipeline(stdoutStream, gzip, writeStream);
    } catch {
      throw new Error("Failed to create backup - server may not be running");
    }
  } else {
    throw new Error("Server must be running to create a backup");
  }

  const stats = fs.statSync(backupPath);
  const checksum = await new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(backupPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
  const result = db.prepare("INSERT INTO backups (server_id, filename, size, checksum) VALUES (?, ?, ?, ?)").run(serverId, filename, stats.size, checksum);
  const backupId = result.lastInsertRowid as number;
  notify("backup_created", "Backup Created", `Backup "${filename}" created for server "${server.name}" (${(stats.size / 1024 / 1024).toFixed(1)} MB)`, 0x00ff00);

  // Async upload to all enabled cloud providers
  const cloudConfigs = db.prepare("SELECT * FROM cloud_storage_configs WHERE server_id = ? AND enabled = 1").all(serverId) as CloudStorageConfig[];
  for (const cfg of cloudConfigs) {
    const uploadId = db.prepare("INSERT INTO backup_uploads (backup_id, storage_id, status) VALUES (?, ?, 'uploading')").run(backupId, cfg.id).lastInsertRowid;
    uploadBackupToCloud(backupPath, filename, cfg)
      .then(() => {
        db.prepare("UPDATE backup_uploads SET status = 'uploaded', checksum = ?, completed_at = datetime('now') WHERE id = ?").run(checksum, uploadId);
      })
      .catch((err: any) => {
        db.prepare("UPDATE backup_uploads SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?").run(err.message, uploadId);
        notify("backup_upload_failed", "Cloud Upload Failed", `Failed to upload "${filename}" to ${cfg.label}: ${err.message}`, 0xff0000);
      });
  }

  return { id: backupId, server_id: serverId, filename, size: stats.size, checksum, created_at: new Date().toISOString() };
}

export async function restoreBackup(serverId: number, backupId: number): Promise<void> {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND server_id = ?").get(backupId, serverId) as Backup | undefined;
  if (!backup) throw new Error("Backup not found");

  const backupPath = path.join(BACKUP_DIR, backup.filename);
  if (!fs.existsSync(backupPath)) throw new Error("Backup file not found");

  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
  if (!server) throw new Error("Server not found");

  const containerName = `biryani-mc-${server.id}`;
  const dataDir = `${process.cwd()}/data/server-${server.id}`;

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create safety snapshot of current data before restore
  let safetySnapshot: string | null = null;
  if (existsSync(dataDir) && fs.readdirSync(dataDir).length > 0) {
    safetySnapshot = path.join(BACKUP_DIR, `safety-${serverId}-${Date.now()}.tar.gz`);
    try {
      const { execSync } = await import("child_process");
      execSync(`tar -czf "${safetySnapshot}" -C "${dataDir}" .`, { timeout: 60000 });
    } catch {
      safetySnapshot = null;
    }
  }

  // Try to reuse existing container; fall back to creating a new one
  let container;
  try {
    container = docker.getContainer(containerName);
    await container.inspect();
    await container.stop({ t: 30 }).catch(() => {});
    await container.start().catch(() => {});
  } catch {
    const image = server.image || "itzg/minecraft-server";
    await docker.pull(image);

    const configs = db.prepare("SELECT key, value FROM server_config WHERE server_id = ?").all(serverId) as { key: string; value: string }[];
    const envVars: Record<string, string> = {
      EULA: "TRUE",
      TYPE: "VANILLA",
      VERSION: server.mc_version,
      MEMORY: `${Math.floor(server.ram_mb / 1024)}G`,
      SERVER_PORT: "25565",
      TZ: "UTC",
    };
    for (const cfg of configs) {
      if (cfg.key !== "EULA" && cfg.key !== "TYPE" && cfg.key !== "VERSION") {
        envVars[cfg.key] = cfg.value;
      }
    }

    container = await docker.createContainer({
      Image: image,
      name: containerName,
      Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        PortBindings: { "25565/tcp": [{ HostPort: server.port.toString() }] },
        Memory: server.ram_mb * 1024 * 1024,
        Binds: [`${dataDir}:/data`],
        RestartPolicy: { Name: "unless-stopped" },
      },
      WorkingDir: "/data",
      Labels: { "biryani.managed": "true", "biryani.server_id": server.id.toString() },
    });
  }

  // Restore archive into the container
  try {
    const restoreStream = createReadStream(backupPath).pipe(createGunzip());
    await container.putArchive(restoreStream, { path: "/data" });
  } catch (err) {
    // Restore safety snapshot on failure
    if (safetySnapshot && existsSync(safetySnapshot)) {
      try {
        const { execSync } = await import("child_process");
        execSync(`tar -xzf "${safetySnapshot}" -C "${dataDir}"`, { timeout: 60000 });
      } catch {}
      try { fs.unlinkSync(safetySnapshot); } catch {}
    }
    throw new Error(`Restore failed: ${(err as Error).message}. Previous data has been restored.`);
  }
  // Clean up safety snapshot on success
  if (safetySnapshot && existsSync(safetySnapshot)) {
    try { fs.unlinkSync(safetySnapshot); } catch {}
  }

  // Now start the container
  await container.start();
  db.prepare("UPDATE servers SET status = 'running', container_id = ? WHERE id = ?").run(container.id, serverId);
  notify("backup_restored", "Backup Restored", `Backup "${backup.filename}" restored for server "${server.name}"`, 0x00ff00);
}

export function deleteBackup(backupId: number) {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(backupId) as Backup | undefined;
  if (backup) {
    const backupPath = path.join(BACKUP_DIR, backup.filename);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    const uploads = db.prepare(`
      SELECT bu.id as upload_id, bu.status, csc.id as storage_id, csc.config_json, csc.provider
      FROM backup_uploads bu
      JOIN cloud_storage_configs csc ON csc.id = bu.storage_id
      WHERE bu.backup_id = ?
    `).all(backupId) as { storage_id: number; config_json: string; provider: string; status: string }[];
    for (const u of uploads) {
      if (u.status === "uploaded") {
        deleteFromCloud({ id: u.storage_id, server_id: 0, provider: u.provider as CloudStorageConfig["provider"], label: "", config_json: u.config_json, enabled: 1, created_at: "" }, backup.filename).catch((err) => {
          console.error(`[backup] Failed to delete "${backup.filename}" from cloud:`, err.message);
        });
      }
    }
  }
  db.prepare("DELETE FROM backups WHERE id = ?").run(backupId);
}

export function rotateBackups(serverId: number, maxBackups: number = 10) {
  const server = db.prepare("SELECT backup_retention FROM servers WHERE id = ?").get(serverId) as { backup_retention: number } | undefined;
  const limit = server?.backup_retention ?? maxBackups;
  const backups = getBackups(serverId);
  if (backups.length > limit) {
    const toDelete = backups.slice(limit);
    for (const backup of toDelete) {
      deleteBackup(backup.id);
    }
  }
}

export function rotateAllBackups() {
  const servers = db.prepare("SELECT id FROM servers").all() as { id: number }[];
  for (const server of servers) {
    rotateBackups(server.id);
  }
}

const autoBackupRunning = new Set<number>();

export async function createAutoBackup(serverId: number): Promise<void> {
  if (autoBackupRunning.has(serverId)) return;
  autoBackupRunning.add(serverId);
  try {
    await createBackup(serverId);
    db.prepare("UPDATE servers SET last_auto_backup = datetime('now') WHERE id = ?").run(serverId);
  } catch (err) {
    console.error(`[auto-backup] Failed for server ${serverId}:`, (err as Error).message);
  } finally {
    autoBackupRunning.delete(serverId);
  }
}

export function checkAndRunAutoBackups(): void {
  const servers = db.prepare(
    "SELECT id, status, auto_backup, backup_interval, last_auto_backup FROM servers WHERE auto_backup = 1"
  ).all() as { id: number; status: string; auto_backup: number; backup_interval: number; last_auto_backup: string | null }[];

  const now = Date.now();
  for (const server of servers) {
    if (server.status !== "running") continue;
    const intervalMs = server.backup_interval * 60 * 1000;
    if (!server.last_auto_backup) {
      createAutoBackup(server.id);
      continue;
    }
    const lastRun = new Date(server.last_auto_backup).getTime();
    if (now - lastRun >= intervalMs) {
      createAutoBackup(server.id);
    }
  }
}
