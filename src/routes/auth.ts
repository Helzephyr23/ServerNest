import { FastifyInstance } from "fastify";
import { getUserByUsername, createUser, verifyPassword, isFirstRun } from "../services/auth.service.js";
import { rateLimit } from "../middleware/rate-limit.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/setup", { preHandler: [rateLimit(5, 60000)] }, async (request, reply) => {
    if (!isFirstRun()) {
      return reply.status(400).send({ error: "Admin already exists" });
    }
    const { username, password } = request.body as { username: string; password: string };
    if (!username || !password || password.length < 6) {
      return reply.status(400).send({ error: "Username and password (min 6 chars) required" });
    }
    const user = await createUser(username, password, "admin");
    const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  });

  app.get("/api/auth/status", async (request, reply) => {
    return { firstRun: isFirstRun() };
  });

  app.post("/api/auth/login", { preHandler: [rateLimit(10, 60000)] }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    if (!username || !password) {
      return reply.status(400).send({ error: "Username and password required" });
    }
    const user = getUserByUsername(username);
    if (!user || !(await verifyPassword(user, password))) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  });

  app.get("/api/auth/me", {
    preHandler: [async (req, reply) => {
      try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) return reply.status(401).send({ error: "No token" });
        const decoded = app.jwt.verify<{ id: number; username: string; role: string }>(token);
        (req as any).user = decoded;
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }
    }]
  }, async (request) => {
    return { user: (request as any).user };
  });
}
