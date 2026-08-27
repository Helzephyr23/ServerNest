import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import {
  getBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
} from "../services/backup.service.js";
import { downloadFromCloud, CloudStorageConfig } from "../services/cloud-storage.service.js";
import db from "../config/database.js";
import fs from "fs";
import path from "path";

interface BackupRow {
  id: number;
  server_id: number;
  filename: string;
  size: number;
  checksum: string | null;
  created_at: string;
}

interface BackupUploadRow {
  id: number;
  backup_id: number;
  storage_id: number;
  status: string;
  checksum: string | null;
  error: string | null;
  config_json: string;
  provider: string;
}

export default async function backupRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/backups", opts, async (request) => {
    const { id } = request.params as { id: string };
    return { backups: getBackups(Number(id)) };
  });

  app.get("/api/servers/:id/backups/progress", opts, async (request) => {
    const { id } = request.params as { id: string };

    // Persisted progress lives in backup_uploads, so it survives a page
    // refresh. Aggregate per backup id + provider, mirroring the shape the
    // frontend expects: { [backupId]: { [provider]: { bytesUploaded,
    // totalBytes, percentage, status } } }.
    const rows = db.prepare(`
      SELECT bu.backup_id, csc.provider, bu.status, bu.bytes_uploaded, bu.total_bytes
      FROM backup_uploads bu
      JOIN cloud_storage_configs csc ON csc.id = bu.storage_id
      JOIN backups b ON b.id = bu.backup_id
      WHERE b.server_id = ?
    `).all(Number(id)) as { backup_id: number; provider: string; status: string; bytes_uploaded: number; total_bytes: number }[];

    const uploads: Record<number, Record<string, { bytesUploaded: number; totalBytes: number; percentage: number; status: string }>> = {};
    for (const row of rows) {
      if (!uploads[row.backup_id]) uploads[row.backup_id] = {};
      uploads[row.backup_id][row.provider] = {
        bytesUploaded: row.bytes_uploaded,
        totalBytes: row.total_bytes,
        percentage: row.total_bytes > 0 ? Math.round((row.bytes_uploaded / row.total_bytes) * 100) : 0,
        status: row.status,
      };
    }
    return { uploads };
  });

  app.post("/api/servers/:id/backups", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    createBackup(Number(id)).catch((err) => {
      console.error("Background backup failed:", err.message);
    });
    return reply.status(202).send({ message: "Backup started" });
  });

  app.post("/api/servers/:id/backups/:backupId/restore", opts, async (request, reply) => {
    try {
      const { id, backupId } = request.params as { id: string; backupId: string };
      await restoreBackup(Number(id), Number(backupId));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.delete("/api/backups/:backupId", opts, async (request) => {
    const { backupId } = request.params as { backupId: string };
    deleteBackup(Number(backupId));
    return { success: true };
  });

  app.get("/api/servers/:id/backups/:backupId/download", opts, async (request, reply) => {
    const { id, backupId } = request.params as { id: string; backupId: string };
    const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND server_id = ?").get(Number(backupId), Number(id)) as BackupRow | undefined;
    if (!backup) return reply.status(404).send({ error: "Backup not found" });

    const localPath = path.resolve(`./data/backups/${backup.filename}`);
    if (fs.existsSync(localPath)) {
      return reply.header("Content-Type", "application/gzip").send(fs.createReadStream(localPath));
    }

    const upload = db.prepare("SELECT bu.*, csc.config_json, csc.provider FROM backup_uploads bu JOIN cloud_storage_configs csc ON csc.id = bu.storage_id WHERE bu.backup_id = ? AND bu.status = 'uploaded' LIMIT 1").get(Number(backupId)) as BackupUploadRow | undefined;
    if (!upload) return reply.status(404).send({ error: "Backup file not available locally or in cloud storage" });

    const tmpDir = path.resolve("./data/backups/tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, backup.filename);
    const cfg = { ...upload, config_json: upload.config_json } as unknown as CloudStorageConfig;
    await downloadFromCloud(cfg, backup.filename, tmpPath);
    reply.header("Content-Type", "application/gzip");
    const stream = fs.createReadStream(tmpPath);
    stream.on("close", () => { try { fs.unlinkSync(tmpPath); } catch {} });
    return reply.send(stream);
  });
}
