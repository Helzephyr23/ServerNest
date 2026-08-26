import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { getAuditLog, getAuditLogCount } from "../services/audit.service.js";

export default async function auditRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware, adminMiddleware] };

  app.get("/api/audit", opts, async (request) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const l = Math.min(Number(limit) || 100, 500);
    const o = Number(offset) || 0;
    return { entries: getAuditLog(l, o), total: getAuditLogCount() };
  });
}
