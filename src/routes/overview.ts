import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import db from "../config/database.js";
import { getNodeMetrics, getCachedNodeMetrics } from "../services/metrics.service.js";
import { getSystemUsage } from "../services/system.service.js";

export default async function overviewRoutes(app: FastifyInstance) {
  app.get("/api/overview", { preHandler: [authMiddleware] }, async (request) => {
    const nodes = db.prepare("SELECT * FROM nodes ORDER BY name ASC").all();
    const { live } = request.query as { live?: string };
    const metrics = live === "true" ? await getNodeMetrics() : getCachedNodeMetrics();
    return { nodes, metrics, system: getSystemUsage() };
  });
}
