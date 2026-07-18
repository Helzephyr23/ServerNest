import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedServer } from "../helpers.js";

const testDb = createTestDb();

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/docker.js", () => ({
  default: {
    ping: vi.fn().mockResolvedValue(true),
    pull: vi.fn().mockResolvedValue(null),
    getContainer: vi.fn().mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
    }),
    createContainer: vi.fn().mockResolvedValue({ id: "test-id", start: vi.fn().mockResolvedValue(undefined) }),
  },
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

const {
  getAllServers, getServerById, createServer, updateServer, deleteServer,
  getServerConfig, setServerConfig, deleteServerConfig, findAvailablePort,
} = await import("../../services/server.service.js");

describe("server.service", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM server_config");
    testDb.exec("DELETE FROM backups");
    testDb.exec("DELETE FROM scheduled_tasks");
    testDb.exec("DELETE FROM installed_mods");
    testDb.exec("DELETE FROM servers");
  });

  describe("createServer", () => {
    it("should create a server and return it", () => {
      const server = createServer({
        name: "Test Server", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048, port: 25565, eula_accepted: true,
      });
      expect(server).toHaveProperty("id");
      expect(server.name).toBe("Test Server");
      expect(server.mc_version).toBe("1.21.4");
      expect(server.software).toBe("vanilla");
      expect(server.ram_mb).toBe(2048);
      expect(server.port).toBe(25565);
      expect(server.status).toBe("stopped");
    });

    it("should create default server_config entries", () => {
      const server = createServer({
        name: "Test", mc_version: "1.21.4", software: "paper", ram_mb: 2048, port: 25565, eula_accepted: true,
      });
      const configs = getServerConfig(server.id);
      expect(configs.length).toBe(2);
      const keys = configs.map((c) => c.key);
      expect(keys).toContain("TYPE");
      expect(keys).toContain("VERSION");
    });

    it("should set TYPE to software name", () => {
      const server = createServer({
        name: "Test", mc_version: "1.21.4", software: "fabric", ram_mb: 2048, port: 25565, eula_accepted: true,
      });
      const configs = getServerConfig(server.id);
      const typeConfig = configs.find((c) => c.key === "TYPE");
      expect(typeConfig?.value).toBe("FABRIC");
    });

    it("should default to VANILLA for vanilla software", () => {
      const server = createServer({
        name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048, port: 25565, eula_accepted: true,
      });
      const configs = getServerConfig(server.id);
      const typeConfig = configs.find((c) => c.key === "TYPE");
      expect(typeConfig?.value).toBe("VANILLA");
    });
  });

  describe("getAllServers", () => {
    it("should return empty array when no servers", () => {
      expect(getAllServers()).toEqual([]);
    });

    it("should return all servers", () => {
      createServer({ name: "S1", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      createServer({ name: "S2", mc_version: "1.21.4", software: "paper", ram_mb: 4096, port: 25566, eula_accepted: true });
      expect(getAllServers().length).toBe(2);
    });
  });

  describe("getServerById", () => {
    it("should return undefined for non-existent id", () => {
      expect(getServerById(9999)).toBeUndefined();
    });

    it("should return the server", () => {
      const created = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      const server = getServerById(created.id);
      expect(server).toBeDefined();
      expect(server!.name).toBe("Test");
    });
  });

  describe("updateServer", () => {
    it("should update server fields", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      updateServer(server.id, { name: "Updated", ram_mb: 4096 });
      const updated = getServerById(server.id)!;
      expect(updated.name).toBe("Updated");
      expect(updated.ram_mb).toBe(4096);
    });

    it("should not change fields not provided", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      updateServer(server.id, { name: "Updated" });
      const updated = getServerById(server.id)!;
      expect(updated.mc_version).toBe("1.21.4");
      expect(updated.ram_mb).toBe(2048);
    });
  });

  describe("deleteServer", () => {
    it("should delete the server and related data", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      deleteServer(server.id);
      expect(getServerById(server.id)).toBeUndefined();
    });

    it("should cascade delete server_config", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      expect(getServerConfig(server.id).length).toBe(2);
      deleteServer(server.id);
      expect(getServerConfig(server.id).length).toBe(0);
    });
  });

  describe("server config", () => {
    it("should set and get config", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      setServerConfig(server.id, "DIFFICULTY", "hard");
      const configs = getServerConfig(server.id);
      expect(configs.find((c) => c.key === "DIFFICULTY")?.value).toBe("hard");
    });

    it("should update existing config", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      setServerConfig(server.id, "DIFFICULTY", "easy");
      setServerConfig(server.id, "DIFFICULTY", "hard");
      const configs = getServerConfig(server.id).filter((c) => c.key === "DIFFICULTY");
      expect(configs.length).toBe(1);
      expect(configs[0].value).toBe("hard");
    });

    it("should delete config", () => {
      const server = createServer({ name: "Test", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      setServerConfig(server.id, "CUSTOM", "value");
      deleteServerConfig(server.id, "CUSTOM");
      expect(getServerConfig(server.id).find((c) => c.key === "CUSTOM")).toBeUndefined();
    });
  });

  describe("findAvailablePort", () => {
    it("should find the first available port", () => {
      expect(findAvailablePort()).toBe(25565);
    });

    it("should skip used ports", () => {
      createServer({ name: "S1", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048,       port: 25565, eula_accepted: true });
      expect(findAvailablePort()).toBe(25566);
    });
  });
});
