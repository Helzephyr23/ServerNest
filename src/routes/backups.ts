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
}
