import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import db from "../config/database.js";
import { getNodeMetrics } from "../services/metrics.service.js";

export default async function overviewRoutes(app: FastifyInstance) {
  app.get("/api/overview", { preHandler: [authMiddleware] }, async () => {
    const nodes = db.prepare("SELECT * FROM nodes ORDER BY name ASC").all();
    const metrics = await getNodeMetrics();
    return { nodes, metrics };
  });
}
