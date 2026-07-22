import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import {
  getAllNotifications,
  createNotification,
  deleteNotification,
  sendDiscordNotification,
} from "../services/notification.service.js";

export default async function notificationRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/notifications", opts, async () => {
    return { notifications: getAllNotifications() };
  });

  app.post("/api/notifications", { preHandler: [authMiddleware, validate(schemas.createNotification)] }, async (request, reply) => {
    const { type, webhook_url, email, events } = request.body as { type: "discord" | "email"; webhook_url?: string; email?: string; events: string[] };
    const notification = createNotification({ type, webhook_url, email, events });
    return reply.status(201).send({ notification });
  });

  app.delete("/api/notifications/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteNotification(Number(id));
    return { success: true };
  });

  app.post("/api/notifications/test", { preHandler: [authMiddleware, validate(schemas.testNotification)] }, async (request, reply) => {
    const { webhook_url } = request.body as { webhook_url: string };
    try {
      await sendDiscordNotification(webhook_url, "Test Notification", "This is a test notification from Biryani.", 0x5865f2);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
