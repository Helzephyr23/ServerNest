import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { listUsers, createUser, getUserById, updateUserRole, updateUserPassword, deleteUser } from "../services/auth.service.js";

export default async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/api/users", { preHandler: [adminMiddleware] }, async () => {
    return { users: listUsers() };
  });

  app.post("/api/users", {
    preHandler: [adminMiddleware, validate(schemas.createUser)],
  }, async (request, reply) => {
    const { username, password, role } = request.body as { username: string; password: string; role?: string };
    if (listUsers().find((u) => (u as { username: string }).username === username)) {
      return reply.status(400).send({ error: "Username already exists" });
    }
    const user = await createUser(username, password, role);
    return { user };
  });

  app.put("/api/users/:id/role", {
    preHandler: [adminMiddleware, validate(schemas.updateUserRole)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: string };
    const user = getUserById(Number(id));
    if (!user) return reply.status(404).send({ error: "User not found" });
    if ((user as { role: string }).role === "admin" && role !== "admin") {
      const adminCount = (listUsers() as { role: string }[]).filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return reply.status(400).send({ error: "Cannot demote the last admin" });
      }
    }
    updateUserRole(Number(id), role);
    return { success: true };
  });

  app.put("/api/users/:id/password", {
    preHandler: [adminMiddleware, validate(schemas.updateUserPassword)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { password } = request.body as { password: string };
    const user = getUserById(Number(id));
    if (!user) return reply.status(404).send({ error: "User not found" });
    await updateUserPassword(Number(id), password);
    return { success: true };
  });

  app.delete("/api/users/:id", {
    preHandler: [adminMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUserById(Number(id));
    if (!user) return reply.status(404).send({ error: "User not found" });
    if (Number(id) === request.user?.id) {
      return reply.status(400).send({ error: "Cannot delete yourself" });
    }
    if (user.role === "admin") {
      const adminCount = (listUsers() as { role: string }[]).filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return reply.status(400).send({ error: "Cannot delete the last admin" });
      }
    }
    deleteUser(Number(id));
    return { success: true };
  });
}
