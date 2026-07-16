import { FastifyRequest, FastifyReply } from "fastify";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return reply.status(401).send({ error: "No token provided" });
    }
    const decoded = request.server.jwt.verify<{ id: number; username: string; role: string }>(token);
    (request as any).user = decoded;
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
