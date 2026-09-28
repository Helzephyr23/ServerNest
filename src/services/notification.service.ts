import db from "../config/database.js";
import { logger } from "../utils/logger.js";
import { URL } from "url";
import dns from "dns";

export interface Notification {
  id: number;
  type: "discord" | "email";
  webhook_url?: string;
  email?: string;
  enabled: boolean;
  events: string;
  created_at: string;
}

function isPrivateIP(hostname: string): boolean {
  // Block private/loopback/link-local ranges
  const privatePatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^0:/,
    /^localhost$/i,
    /^\[::1\]$/,
  ];
  return privatePatterns.some((p) => p.test(hostname));
}

async function validateWebhookUrl(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    if (isPrivateIP(parsed.hostname)) return false;
    // DNS resolve to catch DNS rebinding
    const addresses = await dns.promises.resolve4(parsed.hostname).catch(() => []);
    if (addresses.some(isPrivateIP)) return false;
    return true;
  } catch {
    return false;
  }
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

export function updateNotification(id: number, data: { enabled?: boolean }): Notification | undefined {
  const existing = getNotificationById(id);
  if (!existing) return undefined;
  if (data.enabled !== undefined) {
    db.prepare("UPDATE notifications SET enabled = ? WHERE id = ?").run(data.enabled ? 1 : 0, id);
  }
  return getNotificationById(id);
}

export async function sendDiscordNotification(webhookUrl: string, title: string, message: string, color: number = 0x00ff00): Promise<boolean> {
  if (!(await validateWebhookUrl(webhookUrl))) {
    logger.error("Discord webhook URL rejected: points to private/internal network or invalid protocol");
    return false;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `🥔 ServerNest - ${title}`,
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
