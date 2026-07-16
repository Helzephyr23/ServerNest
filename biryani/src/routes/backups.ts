import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import {
  getBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
} from "../services/backup.service.js";

export default async function backupRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/backups", opts, async (request) => {
    return { backups: getBackups(Number(request.params.id)) };
  });

  app.post("/api/servers/:id/backups", opts, async (request, reply) => {
    try {
      const backup = await createBackup(Number(request.params.id));
      return reply.status(201).send({ backup });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/backups/:backupId/restore", opts, async (request, reply) => {
    try {
      await restoreBackup(Number(request.params.id), Number(request.params.backupId));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/backups/:backupId", opts, async (request) => {
    deleteBackup(Number(request.params.backupId));
    return { success: true };
  });
}
