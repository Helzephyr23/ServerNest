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

const { getAllNotifications, getNotificationById, createNotification, deleteNotification } = await import("../../services/notification.service.js");

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
});
