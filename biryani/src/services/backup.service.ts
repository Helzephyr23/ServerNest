import db from "../config/database.js";
import docker from "../config/docker.js";
import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { Readable } from "stream";
import { mkdirSync, existsSync } from "fs";

interface Backup {
  id: number;
  server_id: number;
  filename: string;
  size: number;
  created_at: string;
}

const BACKUP_DIR = path.resolve("./data/backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export function getBackups(serverId: number): Backup[] {
  return db.prepare("SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC").all(serverId) as Backup[];
}

export async function createBackup(serverId: number): Promise<Backup> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
  if (!server) throw new Error("Server not found");

  const containerName = `biryani-mc-${server.id}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${server.name}-${timestamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, filename);

  if (server.container_id) {
    try {
      const container = docker.getContainer(containerName);
      const archive = await container.export();
      const writeStream = createWriteStream(backupPath);
      await pipeline(Readable.from(archive), createGzip(), writeStream);
    } catch {
      throw new Error("Failed to create backup - server may not be running");
    }
  } else {
    throw new Error("Server must be running to create a backup");
  }

  const stats = fs.statSync(backupPath);
  const result = db.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, filename, stats.size);

  return { id: result.lastInsertRowid as number, server_id: serverId, filename, size: stats.size, created_at: new Date().toISOString() };
}

export async function restoreBackup(serverId: number, backupId: number): Promise<void> {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND server_id = ?").get(backupId, serverId) as Backup | undefined;
  if (!backup) throw new Error("Backup not found");

  const backupPath = path.join(BACKUP_DIR, backup.filename);
  if (!fs.existsSync(backupPath)) throw new Error("Backup file not found");

  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
  if (!server) throw new Error("Server not found");

  const containerName = `biryani-mc-${server.id}`;
  const dataDir = `${process.cwd()}/data/server-${server.id}`;

  // Stop and remove existing container
  try {
    const existing = docker.getContainer(containerName);
    await existing.stop({ t: 30 }).catch(() => {});
    await existing.remove({ force: true }).catch(() => {});
  } catch {}

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create a new container (without starting)
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

  const container = await docker.createContainer({
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

  // Restore archive into the new container
  const restoreStream = createReadStream(backupPath).pipe(createGunzip());
  await container.putArchive(restoreStream, { path: "/data" });

  // Now start the container
  await container.start();
  db.prepare("UPDATE servers SET status = 'running', container_id = ? WHERE id = ?").run(container.id, serverId);
}

export function deleteBackup(backupId: number) {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(backupId) as Backup | undefined;
  if (backup) {
    const backupPath = path.join(BACKUP_DIR, backup.filename);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }
  db.prepare("DELETE FROM backups WHERE id = ?").run(backupId);
}

export function rotateBackups(serverId: number, maxBackups: number = 10) {
  const backups = getBackups(serverId);
  if (backups.length > maxBackups) {
    const toDelete = backups.slice(maxBackups);
    for (const backup of toDelete) {
      deleteBackup(backup.id);
    }
  }
}

export function rotateAllBackups(maxBackups: number = 10) {
  const servers = db.prepare("SELECT id FROM servers").all() as { id: number }[];
  for (const server of servers) {
    rotateBackups(server.id, maxBackups);
  }
}
