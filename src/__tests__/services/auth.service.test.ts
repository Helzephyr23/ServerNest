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

const { getUserByUsername, getUserById, createUser, verifyPassword, isFirstRun } = await import("../../services/auth.service.js");

describe("auth.service", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM users");
  });

  describe("createUser", () => {
    it("should create a user and return user data", async () => {
      const user = await createUser("admin", "password123", "admin");
      expect(user).toHaveProperty("id");
      expect(user.username).toBe("admin");
      expect(user.role).toBe("admin");
    });

    it("should hash the password", async () => {
      await createUser("admin", "password123");
      const row = testDb.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
      expect(row.password_hash).not.toBe("password123");
      expect(row.password_hash.length).toBeGreaterThan(20);
    });

    it("should throw on duplicate username", async () => {
      await createUser("admin", "password123");
      await expect(createUser("admin", "other123")).rejects.toThrow();
    });
  });

  describe("getUserByUsername", () => {
    it("should return undefined for non-existent user", () => {
      expect(getUserByUsername("nobody")).toBeUndefined();
    });

    it("should return the user if it exists", async () => {
      await createUser("admin", "password123");
      const user = getUserByUsername("admin");
      expect(user).toBeDefined();
      expect(user!.username).toBe("admin");
    });
  });

  describe("getUserById", () => {
    it("should return undefined for non-existent id", () => {
      expect(getUserById(9999)).toBeUndefined();
    });

    it("should return the user by id", async () => {
      const created = await createUser("admin", "password123");
      const user = getUserById(created.id as number);
      expect(user).toBeDefined();
      expect(user!.username).toBe("admin");
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      await createUser("admin", "password123");
      const dbUser = getUserByUsername("admin")!;
      expect(await verifyPassword(dbUser, "password123")).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      await createUser("admin", "password123");
      const dbUser = getUserByUsername("admin")!;
      expect(await verifyPassword(dbUser, "wrongpassword")).toBe(false);
    });
  });

  describe("isFirstRun", () => {
    it("should return true when no users exist", () => {
      testDb.exec("DELETE FROM users");
      expect(isFirstRun()).toBe(true);
    });

    it("should return false when users exist", async () => {
      await createUser("admin", "password123");
      expect(isFirstRun()).toBe(false);
    });
  });
});
