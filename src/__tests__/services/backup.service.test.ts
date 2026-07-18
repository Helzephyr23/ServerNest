import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedServer } from "../helpers.js";

const testDb = createTestDb();

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/docker.js", () => ({
  default: {
    ping: vi.fn().mockResolvedValue(true),
    pull: vi.fn().mockResolvedValue(null),
    getContainer: vi.fn().mockReturnValue({
      export: vi.fn().mockResolvedValue(Buffer.from("test")),
    }),
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

const { getBackups, deleteBackup, rotateBackups, rotateAllBackups } = await import("../../services/backup.service.js");

describe("backup.service", () => {
  let serverId: number;

  beforeEach(() => {
    testDb.exec("DELETE FROM backups");
    testDb.exec("DELETE FROM server_config");
    testDb.exec("DELETE FROM servers");
    serverId = seedServer(testDb);
  });

  describe("getBackups", () => {
    it("should return empty array for server with no backups", () => {
      expect(getBackups(serverId)).toEqual([]);
    });

    it("should return backups for a server", () => {
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "test.tar.gz", 1024);
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "test2.tar.gz", 2048);
      expect(getBackups(serverId).length).toBe(2);
    });

    it("should return backups ordered by created_at DESC", () => {
      testDb.prepare("INSERT INTO backups (server_id, filename, size, created_at) VALUES (?, ?, ?, ?)").run(serverId, "old.tar.gz", 100, "2024-01-01");
      testDb.prepare("INSERT INTO backups (server_id, filename, size, created_at) VALUES (?, ?, ?, ?)").run(serverId, "new.tar.gz", 200, "2024-06-01");
      const backups = getBackups(serverId);
      expect(backups[0].filename).toBe("new.tar.gz");
    });

    it("should only return backups for the specified server", () => {
      const serverId2 = seedServer(testDb, { name: "S2", port: 25566 });
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "s1.tar.gz", 100);
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId2, "s2.tar.gz", 200);
      expect(getBackups(serverId).length).toBe(1);
      expect(getBackups(serverId)[0].filename).toBe("s1.tar.gz");
    });
  });

  describe("deleteBackup", () => {
    it("should delete backup from database", () => {
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "test.tar.gz", 1024);
      const backup = testDb.prepare("SELECT * FROM backups WHERE filename = 'test.tar.gz'").get() as any;
      deleteBackup(backup.id);
      expect((testDb.prepare("SELECT COUNT(*) as count FROM backups").get() as any).count).toBe(0);
    });
  });

  describe("rotateBackups", () => {
    it("should keep max backups and delete oldest", () => {
      for (let i = 0; i < 15; i++) {
        testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, `backup-${i}.tar.gz`, 100);
      }
      rotateBackups(serverId, 10);
      expect(getBackups(serverId).length).toBe(10);
    });

    it("should not delete if under the limit", () => {
      for (let i = 0; i < 5; i++) {
        testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, `backup-${i}.tar.gz`, 100);
      }
      rotateBackups(serverId, 10);
      expect(getBackups(serverId).length).toBe(5);
    });
  });

  describe("rotateAllBackups", () => {
    it("should rotate backups for all servers", () => {
      const s2Id = seedServer(testDb, { name: "S2", port: 25566 });
      for (let i = 0; i < 12; i++) {
        testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, `s1-${i}.tar.gz`, 100);
        testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(s2Id, `s2-${i}.tar.gz`, 100);
      }
      rotateAllBackups(10);
      expect(getBackups(serverId).length).toBe(10);
      expect(getBackups(s2Id).length).toBe(10);
    });
  });
});
