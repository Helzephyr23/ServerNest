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

export default async function backupRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/backups", opts, async (request) => {
    const { id } = request.params as { id: string };
    return { backups: getBackups(Number(id)) };
  });

  app.post("/api/servers/:id/backups", opts, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const backup = await createBackup(Number(id));
      return reply.status(201).send({ backup });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/backups/:backupId/restore", opts, async (request, reply) => {
    try {
      const { id, backupId } = request.params as { id: string; backupId: string };
      await restoreBackup(Number(id), Number(backupId));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/backups/:backupId", opts, async (request) => {
    const { backupId } = request.params as { backupId: string };
    deleteBackup(Number(backupId));
    return { success: true };
  });

  app.get("/api/servers/:id/backups/:backupId/download", opts, async (request, reply) => {
    const { id, backupId } = request.params as { id: string; backupId: string };
    const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND server_id = ?").get(Number(backupId), Number(id)) as any;
    if (!backup) return reply.status(404).send({ error: "Backup not found" });

    const localPath = path.resolve(`./data/backups/${backup.filename}`);
    if (fs.existsSync(localPath)) {
      return reply.header("Content-Type", "application/gzip").send(fs.createReadStream(localPath));
    }

    const upload = db.prepare("SELECT bu.*, csc.config_json, csc.provider FROM backup_uploads bu JOIN cloud_storage_configs csc ON csc.id = bu.storage_id WHERE bu.backup_id = ? AND bu.status = 'uploaded' LIMIT 1").get(Number(backupId)) as any;
    if (!upload) return reply.status(404).send({ error: "Backup file not available locally or in cloud storage" });

    const tmpDir = path.resolve("./data/backups/tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, backup.filename);
    const cfg: CloudStorageConfig = { ...upload, config_json: upload.config_json };
    await downloadFromCloud(cfg, backup.filename, tmpPath);
    reply.header("Content-Type", "application/gzip");
    const stream = fs.createReadStream(tmpPath);
    stream.on("close", () => { try { fs.unlinkSync(tmpPath); } catch {} });
    return reply.send(stream);
  });
}
