import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedServer } from "../helpers.js";
import { PassThrough } from "stream";

const testDb = createTestDb();

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));

const mockBackupContainer = {
  exec: vi.fn().mockResolvedValue({
    start: vi.fn().mockImplementation(() => {
      const s = new PassThrough();
      const tar = Buffer.from("file-data");
      const header = Buffer.alloc(8);
      header.writeUInt32BE(1, 0);
      header.writeUInt32BE(tar.length, 4);
      process.nextTick(() => { s.write(Buffer.concat([header, tar])); s.end(); });
      return s;
    }),
  }),
  inspect: vi.fn().mockResolvedValue({}),
  stop: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  putArchive: vi.fn().mockResolvedValue(undefined),
};
vi.mock("../../config/docker.js", () => ({
  default: {
    ping: vi.fn().mockResolvedValue(true),
    pull: vi.fn().mockResolvedValue(null),
    getContainer: vi.fn().mockReturnValue(mockBackupContainer),
    createContainer: vi.fn().mockResolvedValue({ id: "test-container-id", start: vi.fn().mockResolvedValue(undefined) }),
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
vi.mock("../../services/notification.service.js", () => ({ notify: vi.fn() }));
vi.mock("../../services/cloud-storage.service.js", () => ({
  uploadBackupToCloud: vi.fn().mockResolvedValue(undefined),
  deleteFromCloud: vi.fn().mockResolvedValue(undefined),
}));

const { getBackups, deleteBackup, rotateBackups, rotateAllBackups, createBackup, restoreBackup } = await import("../../services/backup.service.js");
const { deleteFromCloud } = await import("../../services/cloud-storage.service.js") as unknown as { deleteFromCloud: ReturnType<typeof vi.fn> };

describe("backup.service", () => {
  let serverId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    testDb.exec("DELETE FROM backups");
    testDb.exec("DELETE FROM backup_uploads");
    testDb.exec("DELETE FROM server_config");
    testDb.exec("DELETE FROM servers");
    serverId = seedServer(testDb);
    testDb.prepare("UPDATE servers SET container_id = 'fake-container-id' WHERE id = ?").run(serverId);
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
    it("should delete backup (all scope) from database", () => {
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "test.tar.gz", 1024);
      const backup = testDb.prepare("SELECT * FROM backups WHERE filename = 'test.tar.gz'").get() as any;
      deleteBackup(backup.id);
      expect((testDb.prepare("SELECT COUNT(*) as count FROM backups").get() as any).count).toBe(0);
    });

    it("should delete local scope only, keeping the backup row and cloud uploads", () => {
      testDb.prepare("INSERT INTO cloud_storage_configs (server_id, provider, label, config_json, enabled) VALUES (?, 'gdrive', 'Drive', '{}', 1)").run(serverId);
      const storageId = (testDb.prepare("SELECT id FROM cloud_storage_configs WHERE server_id = ?").get(serverId) as any).id;
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "test.tar.gz", 1024);
      const backup = testDb.prepare("SELECT * FROM backups WHERE filename = 'test.tar.gz'").get() as any;
      testDb.prepare("INSERT INTO backup_uploads (backup_id, storage_id, status) VALUES (?, ?, 'uploaded')").run(backup.id, storageId);

      deleteBackup(backup.id, "local");

      expect((testDb.prepare("SELECT COUNT(*) as count FROM backups").get() as any).count).toBe(1);
      expect((testDb.prepare("SELECT COUNT(*) as count FROM backup_uploads").get() as any).count).toBe(1);
    });

    it("should delete cloud scope only, keeping the backup row and local copy", () => {
      testDb.prepare("INSERT INTO cloud_storage_configs (server_id, provider, label, config_json, enabled) VALUES (?, 'gdrive', 'Drive', '{}', 1)").run(serverId);
      const storageId = (testDb.prepare("SELECT id FROM cloud_storage_configs WHERE server_id = ?").get(serverId) as any).id;
      testDb.prepare("INSERT INTO backups (server_id, filename, size) VALUES (?, ?, ?)").run(serverId, "test.tar.gz", 1024);
      const backup = testDb.prepare("SELECT * FROM backups WHERE filename = 'test.tar.gz'").get() as any;
      testDb.prepare("INSERT INTO backup_uploads (backup_id, storage_id, status) VALUES (?, ?, 'uploaded')").run(backup.id, storageId);

      deleteBackup(backup.id, "cloud");

      expect(deleteFromCloud).toHaveBeenCalled();
      expect((testDb.prepare("SELECT COUNT(*) as count FROM backups").get() as any).count).toBe(1);
      expect((testDb.prepare("SELECT COUNT(*) as count FROM backup_uploads").get() as any).count).toBe(0);
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
      rotateAllBackups();
      expect(getBackups(serverId).length).toBe(10);
      expect(getBackups(s2Id).length).toBe(10);
    });
  });

  describe("createBackup", () => {
    it("should create a backup and record it", async () => {
      const backup = await createBackup(serverId);
      expect(backup.id).toBeDefined();
      expect(backup.server_id).toBe(serverId);
      expect(backup.filename).toContain("Test Server");
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.checksum).toBeDefined();
      expect(getBackups(serverId).length).toBe(1);
    });

    it("should throw if server not found", async () => {
      await expect(createBackup(9999)).rejects.toThrow("Server not found");
    });

    it("should throw if server has no container", async () => {
      const noContainerId = seedServer(testDb, { name: "NoContainer", port: 25570 });
      await expect(createBackup(noContainerId)).rejects.toThrow("Server must be running");
    });
  });

  describe("restoreBackup", () => {
    it("should restore a backup and start the server", async () => {
      const backup = await createBackup(serverId);
      await restoreBackup(serverId, backup.id);
      expect(getBackups(serverId).length).toBe(1);
    });

    it("should throw if backup not found", async () => {
      await expect(restoreBackup(serverId, 9999)).rejects.toThrow("Backup not found");
    });
  });
});
