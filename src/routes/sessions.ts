import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { getSessions, revokeSession, revokeAllUserSessions } from "../services/auth.service.js";

export default async function sessionRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/sessions", opts, async (request) => {
    const user = (request as any).user;
    const sessions = getSessions(user.id);
    return { sessions };
  });

  app.delete("/api/sessions/:id", opts, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const allSessions = getSessions(user.id);
    const target = allSessions.find((s) => s.id === Number(id));
    if (!target) return reply.status(404).send({ error: "Session not found" });
    revokeSession(Number(id));
    return { success: true };
  });

  app.post("/api/sessions/revoke-all", opts, async (request) => {
    const user = (request as any).user;
    const token = request.headers.authorization?.replace("Bearer ", "");
    let currentJti: string | undefined;
    if (token) {
      try {
        const decoded = request.server.jwt.verify<{ jti?: string }>(token);
        currentJti = decoded.jti;
      } catch {}
    }
    revokeAllUserSessions(user.id, currentJti);
    return { success: true };
  });
}
