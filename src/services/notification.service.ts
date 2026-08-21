import db from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface Notification {
  id: number;
  type: "discord" | "email";
  webhook_url?: string;
  email?: string;
  enabled: boolean;
  events: string;
  created_at: string;
}

export function getAllNotifications(): Notification[] {
  return db.prepare("SELECT * FROM notifications ORDER BY created_at DESC").all() as Notification[];
}

export function getNotificationById(id: number): Notification | undefined {
  return db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as Notification | undefined;
}

export function createNotification(data: {
  type: "discord" | "email";
  webhook_url?: string;
  email?: string;
  events: string[];
}): Notification {
  const result = db.prepare(
    "INSERT INTO notifications (type, webhook_url, email, events) VALUES (?, ?, ?, ?)"
  ).run(data.type, data.webhook_url || null, data.email || null, JSON.stringify(data.events));
  return getNotificationById(result.lastInsertRowid as number)!;
}

export function deleteNotification(id: number) {
  db.prepare("DELETE FROM notifications WHERE id = ?").run(id);
}

export async function sendDiscordNotification(webhookUrl: string, title: string, message: string, color: number = 0x00ff00): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `🥔 Biryani - ${title}`,
          description: message,
          color,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return res.ok;
  } catch (err) {
    logger.error("Failed to send Discord notification:", err);
    return false;
  }
}

export async function notify(event: string, title: string, message: string, color: number = 0x00ff00) {
  const notifications = db.prepare(
    "SELECT * FROM notifications WHERE enabled = 1"
  ).all() as Notification[];

  for (const notif of notifications) {
    const events: string[] = JSON.parse(notif.events || "[]");
    if (!events.includes(event) && !events.includes("all")) continue;

    if (notif.type === "discord" && notif.webhook_url) {
      await sendDiscordNotification(notif.webhook_url, title, message, color);
    }
  }
}
