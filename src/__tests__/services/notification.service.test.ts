import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../helpers.js";

const testDb = createTestDb();

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/docker.js", () => ({
  default: { ping: vi.fn(), pull: vi.fn(), getContainer: vi.fn(), createContainer: vi.fn() },
  isDockerAvailable: vi.fn().mockResolvedValue(true),
  getImageName: vi.fn().mockReturnValue("itzg/minecraft-server"),
}));
vi.mock("../../config/env.js", () => ({
  env: {
    NODE_ENV: "test", PANEL_HOST: "127.0.0.1", PANEL_PORT: 3000, API_PORT: 3001,
    JWT_SECRET: "test-secret", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
    DOCKER_IMAGE: "itzg/minecraft-server", SERVER_PORT_RANGE_START: 25565,
    SERVER_PORT_RANGE_END: 25665, NODE_NAME: "master", NODE_API_KEY: "test-key", GRPC_PORT: 50051,
  },
}));

const { getAllNotifications, getNotificationById, createNotification, deleteNotification, sendDiscordNotification, notify } = await import("../../services/notification.service.js");

describe("notification.service", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM notifications");
  });

  describe("createNotification", () => {
    it("should create a discord notification", () => {
      const notif = createNotification({
        type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["server_start", "server_stop"],
      });
      expect(notif).toHaveProperty("id");
      expect(notif.type).toBe("discord");
      expect(notif.webhook_url).toBe("https://discord.com/api/webhooks/123/abc");
      expect(Number(notif.enabled)).toBe(1);
    });

    it("should create an email notification", () => {
      const notif = createNotification({ type: "email", email: "admin@example.com", events: ["backup_complete"] });
      expect(notif.type).toBe("email");
      expect(notif.email).toBe("admin@example.com");
    });

    it("should store events as JSON string", () => {
      const notif = createNotification({
        type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["server_start", "server_stop"],
      });
      const dbNotif = testDb.prepare("SELECT * FROM notifications WHERE id = ?").get(notif.id) as any;
      expect(JSON.parse(dbNotif.events)).toEqual(["server_start", "server_stop"]);
    });
  });

  describe("getAllNotifications", () => {
    it("should return empty when none exist", () => {
      expect(getAllNotifications()).toEqual([]);
    });

    it("should return all notifications", () => {
      createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["all"] });
      createNotification({ type: "email", email: "admin@example.com", events: ["backup_complete"] });
      expect(getAllNotifications().length).toBe(2);
    });
  });

  describe("getNotificationById", () => {
    it("should return undefined for non-existent", () => {
      expect(getNotificationById(9999)).toBeUndefined();
    });

    it("should return notification by id", () => {
      const notif = createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["all"] });
      expect(getNotificationById(notif.id)).toBeDefined();
    });
  });

  describe("deleteNotification", () => {
    it("should delete a notification", () => {
      const notif = createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["all"] });
      deleteNotification(notif.id);
      expect(getNotificationById(notif.id)).toBeUndefined();
    });
  });

  describe("sendDiscordNotification", () => {
    beforeEach(() => { vi.unstubAllGlobals(); });

    it("should return true on successful webhook call", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      expect(await sendDiscordNotification("https://discord.com/api/webhooks/123/abc", "Test", "Hello")).toBe(true);
    });

    it("should return false on HTTP error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
      expect(await sendDiscordNotification("https://discord.com/api/webhooks/123/abc", "Test", "Hello")).toBe(false);
    });

    it("should return false on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
      expect(await sendDiscordNotification("https://discord.com/api/webhooks/123/abc", "Test", "Hello")).toBe(false);
    });
  });

  describe("notify", () => {
    beforeEach(() => { vi.unstubAllGlobals(); });

    it("should send to enabled matching notifications", async () => {
      createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["server_start"] });
      const spy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", spy);
      await notify("server_start", "Started", "Server is up");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe("https://discord.com/api/webhooks/123/abc");
    });

    it("should not send to disabled notifications", async () => {
      const notif = createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["server_start"] });
      testDb.prepare("UPDATE notifications SET enabled = 0 WHERE id = ?").run(notif.id);
      const spy = vi.fn();
      vi.stubGlobal("fetch", spy);
      await notify("server_start", "Started", "Server is up");
      expect(spy).not.toHaveBeenCalled();
    });

    it("should not send to non-matching event types", async () => {
      createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["backup_complete"] });
      const spy = vi.fn();
      vi.stubGlobal("fetch", spy);
      await notify("server_start", "Started", "Server is up");
      expect(spy).not.toHaveBeenCalled();
    });

    it("should send to 'all' event type for any event", async () => {
      createNotification({ type: "discord", webhook_url: "https://discord.com/api/webhooks/123/abc", events: ["all"] });
      const spy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", spy);
      await notify("server_start", "Started", "Server is up");
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
