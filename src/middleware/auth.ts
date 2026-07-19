import { FastifyRequest, FastifyReply } from "fastify";
import { getUserById, getSessionByJti, touchSession } from "../services/auth.service.js";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return reply.status(401).send({ error: "No token provided" });
    }
    const decoded = request.server.jwt.verify<{ id: number; username: string; role: string; jti?: string }>(token);
    const user = getUserById(decoded.id);
    if (!user) {
      return reply.status(401).send({ error: "User no longer exists" });
    }
    if (decoded.jti) {
      const session = getSessionByJti(decoded.jti);
      if (!session) {
        return reply.status(401).send({ error: "Session has been revoked" });
      }
      touchSession(decoded.jti);
    }
    (request as any).user = { id: user.id, username: user.username, role: user.role };
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user || user.role !== "admin") {
    return reply.status(403).send({ error: "Admin access required" });
  }
}
