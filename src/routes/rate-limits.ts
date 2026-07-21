import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import db from "../config/database.js";
import { loadRateLimits } from "../middleware/rate-limit.js";

interface RateLimitRule {
  id: number;
  route: string;
  method: string;
  max_requests: number;
  window_ms: number;
  enabled: number;
  description: string | null;
}

export default async function rateLimitRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware, adminMiddleware] };

  app.get("/api/rate-limits", opts, async () => {
    const rules = db.prepare("SELECT * FROM rate_limits ORDER BY created_at DESC").all();
    return { rules };
  });

  app.post("/api/rate-limits", opts, async (request, reply) => {
    const body = request.body as { route?: string; method?: string; max_requests?: number; window_ms?: number; description?: string };
    if (!body.route || !body.max_requests || !body.window_ms) {
      return reply.status(400).send({ error: "route, max_requests, and window_ms are required" });
    }
    const result = db
      .prepare("INSERT INTO rate_limits (route, method, max_requests, window_ms, description) VALUES (?, ?, ?, ?, ?)")
      .run(body.route, body.method || "POST", body.max_requests, body.window_ms, body.description || null);
    loadRateLimits();
    return reply.status(201).send({ id: result.lastInsertRowid });
  });

  app.put("/api/rate-limits/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = db.prepare("SELECT * FROM rate_limits WHERE id = ?").get(Number(id)) as RateLimitRule | undefined;
    if (!existing) return reply.status(404).send({ error: "Rule not found" });
    const body = request.body as { route?: string; method?: string; max_requests?: number; window_ms?: number; enabled?: boolean; description?: string };
    db.prepare("UPDATE rate_limits SET route = ?, method = ?, max_requests = ?, window_ms = ?, enabled = ?, description = ? WHERE id = ?")
      .run(
        body.route ?? existing.route,
        body.method ?? existing.method,
        body.max_requests ?? existing.max_requests,
        body.window_ms ?? existing.window_ms,
        body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
        body.description !== undefined ? body.description : existing.description,
        Number(id),
      );
    loadRateLimits();
    return { success: true };
  });

  app.delete("/api/rate-limits/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = db.prepare("SELECT * FROM rate_limits WHERE id = ?").get(Number(id));
    if (!existing) return reply.status(404).send({ error: "Rule not found" });
    db.prepare("DELETE FROM rate_limits WHERE id = ?").run(Number(id));
    loadRateLimits();
    return { success: true };
  });
}
