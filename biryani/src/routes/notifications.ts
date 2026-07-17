import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
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

  app.post("/api/notifications", opts, async (request, reply) => {
    const { type, webhook_url, email, events } = request.body as any;
    if (!type || !events?.length) {
      return reply.status(400).send({ error: "type and events are required" });
    }
    if (type === "discord" && !webhook_url) {
      return reply.status(400).send({ error: "webhook_url is required for Discord" });
    }
    if (type === "email" && !email) {
      return reply.status(400).send({ error: "email is required for email notifications" });
    }
    const notification = createNotification({ type, webhook_url, email, events });
    return reply.status(201).send({ notification });
  });

  app.delete("/api/notifications/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteNotification(Number(id));
    return { success: true };
  });

  app.post("/api/notifications/test", opts, async (request, reply) => {
    const { webhook_url } = request.body as { webhook_url: string };
    if (!webhook_url) return reply.status(400).send({ error: "webhook_url is required" });
    try {
      await sendDiscordNotification(webhook_url, "Test Notification", "This is a test notification from Biryani.", 0x5865f2);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
