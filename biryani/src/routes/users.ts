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
    const { username, password, role } = request.body as any;
    const existing = getUserById(0);
    if (listUsers().find((u: any) => u.username === username)) {
      return reply.status(400).send({ error: "Username already exists" });
    }
    const user = await createUser(username, password, role);
    return { user };
  });

  app.put("/api/users/:id/role", {
    preHandler: [adminMiddleware, validate(schemas.updateUserRole)],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { role } = request.body as any;
    const user = getUserById(Number(id));
    if (!user) return reply.status(404).send({ error: "User not found" });
    updateUserRole(Number(id), role);
    return { success: true };
  });

  app.put("/api/users/:id/password", {
    preHandler: [adminMiddleware, validate(schemas.updateUserPassword)],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { password } = request.body as any;
    const user = getUserById(Number(id));
    if (!user) return reply.status(404).send({ error: "User not found" });
    await updateUserPassword(Number(id), password);
    return { success: true };
  });

  app.delete("/api/users/:id", {
    preHandler: [adminMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const user = getUserById(Number(id));
    if (!user) return reply.status(404).send({ error: "User not found" });
    if (Number(id) === (request as any).user.id) {
      return reply.status(400).send({ error: "Cannot delete yourself" });
    }
    deleteUser(Number(id));
    return { success: true };
  });
}
