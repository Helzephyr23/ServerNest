import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedServer } from "../helpers.js";

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

const {
  getAllTasks, getTasksForServer, getTaskById, createTask, updateTask, deleteTask, parseSchedule,
} = await import("../../services/schedule.service.js");

describe("schedule.service", () => {
  let serverId: number;

  beforeEach(() => {
    testDb.exec("DELETE FROM scheduled_tasks");
    testDb.exec("DELETE FROM server_config");
    testDb.exec("DELETE FROM servers");
    serverId = seedServer(testDb);
  });

  describe("createTask", () => {
    it("should create a task and return it", () => {
      const task = createTask({ server_id: serverId, name: "Daily Backup", type: "backup", schedule: "0 2 * * *" });
      expect(task).toHaveProperty("id");
      expect(task.name).toBe("Daily Backup");
      expect(task.type).toBe("backup");
      expect(task.schedule).toBe("0 2 * * *");
    });

    it("should store command for command type", () => {
      const task = createTask({ server_id: serverId, name: "Say Hello", type: "command", schedule: "0 * * * *", command: "say Hello!" });
      expect(task.command).toBe("say Hello!");
    });
  });

  describe("getAllTasks", () => {
    it("should return all tasks", () => {
      createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "0 * * * *" });
      createTask({ server_id: serverId, name: "T2", type: "restart", schedule: "0 0 * * *" });
      expect(getAllTasks().length).toBe(2);
    });
  });

  describe("getTasksForServer", () => {
    it("should only return tasks for a specific server", () => {
      const s2Id = seedServer(testDb, { name: "S2", port: 25566 });
      createTask({ server_id: serverId, name: "S1 Task", type: "backup", schedule: "0 * * * *" });
      createTask({ server_id: s2Id, name: "S2 Task", type: "backup", schedule: "0 * * * *" });
      expect(getTasksForServer(serverId).length).toBe(1);
      expect(getTasksForServer(serverId)[0].name).toBe("S1 Task");
    });
  });

  describe("getTaskById", () => {
    it("should return undefined for non-existent task", () => {
      expect(getTaskById(9999)).toBeUndefined();
    });

    it("should return task by id", () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "0 * * * *" });
      expect(getTaskById(task.id)).toBeDefined();
    });
  });

  describe("updateTask", () => {
    it("should update task fields", () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "0 * * * *" });
      updateTask(task.id, { name: "Updated", schedule: "0 6 * * *" });
      const updated = getTaskById(task.id)!;
      expect(updated.name).toBe("Updated");
      expect(updated.schedule).toBe("0 6 * * *");
    });

    it("should update enabled flag", () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "0 * * * *" });
      updateTask(task.id, { enabled: false });
      expect(getTaskById(task.id)!.enabled).toBe(0);
    });
  });

  describe("deleteTask", () => {
    it("should delete a task", () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "0 * * * *" });
      deleteTask(task.id);
      expect(getTaskById(task.id)).toBeUndefined();
    });
  });

  describe("parseSchedule", () => {
    it("should parse interval schedule (*/30 * * * *)", () => {
      expect(parseSchedule("*/30 * * * *")).toBe(30 * 60 * 1000);
    });

    it("should parse hourly interval (0 */2 * * *)", () => {
      expect(parseSchedule("0 */2 * * *")).toBe(2 * 60 * 60 * 1000);
    });

    it("should return null for invalid schedule", () => {
      expect(parseSchedule("invalid")).toBeNull();
    });

    it("should parse specific time schedule", () => {
      expect(parseSchedule("0 3 * * *")).toBeGreaterThan(0);
    });
  });
});
