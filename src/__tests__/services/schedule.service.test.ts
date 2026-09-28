import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, seedServer } from "../helpers.js";

const testDb = createTestDb();

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/docker.js", () => ({
  default: { ping: vi.fn(), pull: vi.fn(), getContainer: vi.fn(), createContainer: vi.fn(), listContainers: vi.fn().mockResolvedValue([]) },
  isDockerAvailable: vi.fn().mockResolvedValue(true),
  getImageName: vi.fn().mockReturnValue("itzg/minecraft-server"),
}));
vi.mock("../../config/env.js", () => ({
  env: {
    NODE_ENV: "test", PANEL_HOST: "127.0.0.1", PANEL_PORT: 3000, API_PORT: 3001,
    JWT_SECRET: "test-secret", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
    DOCKER_IMAGE: "itzg/minecraft-server", SERVER_PORT_RANGE_START: 25565,
    SERVER_PORT_RANGE_END: 25665, SERVER_DATA_DIR: "./data", NODE_NAME: "master", NODE_API_KEY: "test-key", GRPC_PORT: 50051,
  },
}));

const {
  getAllTasks, getTasksForServer, getTaskById, createTask, updateTask, deleteTask, parseSchedule,
  startTask, stopTask, startAllTasks,
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
    it("should return null for invalid schedule", () => {
      expect(parseSchedule("invalid")).toBeNull();
    });

    it("should return positive ms for every-30-minutes (*/30 * * * *)", () => {
      expect(parseSchedule("*/30 * * * *")).toBeGreaterThan(0);
    });

    it("should return positive ms for every-2-hours (0 */2 * * *)", () => {
      expect(parseSchedule("0 */2 * * *")).toBeGreaterThan(0);
    });

    it("should return positive ms for daily at specific time (0 3 * * *)", () => {
      expect(parseSchedule("0 3 * * *")).toBeGreaterThan(0);
    });

    it("should return positive ms for day-of-month (0 0 15 * *)", () => {
      expect(parseSchedule("0 0 15 * *")).toBeGreaterThan(0);
    });

    it("should return positive ms for day-of-week (0 0 * * 1)", () => {
      expect(parseSchedule("0 0 * * 1")).toBeGreaterThan(0);
    });

    it("should return positive ms for month constraint (0 0 1 6 *)", () => {
      expect(parseSchedule("0 0 1 6 *")).toBeGreaterThan(0);
    });

    it("should return positive ms for complex schedule (30 2 * * 0)", () => {
      expect(parseSchedule("30 2 * * 0")).toBeGreaterThan(0);
    });
  });

  describe("startTask / stopTask", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("should call the executor after the scheduled delay", async () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "*/30 * * * *" });
      const executor = vi.fn().mockResolvedValue(undefined);
      startTask(task, executor);
      expect(executor).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);
      expect(executor).toHaveBeenCalledTimes(1);

      stopTask(task.id);
    });

    it("should reschedule after execution", async () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "*/30 * * * *" });
      const executor = vi.fn().mockResolvedValue(undefined);
      startTask(task, executor);

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);
      expect(executor).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);
      expect(executor).toHaveBeenCalledTimes(2);

      stopTask(task.id);
    });

    it("should stop a running task", async () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "*/30 * * * *" });
      const executor = vi.fn().mockResolvedValue(undefined);
      startTask(task, executor);
      stopTask(task.id);
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(executor).not.toHaveBeenCalled();
    });

    it("should not throw when stopping a task that was never started", () => {
      expect(() => stopTask(9999)).not.toThrow();
    });

    it("should update last_run after execution", async () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "*/30 * * * *" });
      const executor = vi.fn().mockResolvedValue(undefined);
      startTask(task, executor);
      expect(getTaskById(task.id)!.last_run).toBeNull();

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);
      expect(getTaskById(task.id)!.last_run).toBeTruthy();

      stopTask(task.id);
    });

    it("should update next_run when task starts", () => {
      const task = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "*/30 * * * *" });
      const executor = vi.fn().mockResolvedValue(undefined);
      startTask(task, executor);
      expect(getTaskById(task.id)!.next_run).toBeTruthy();
      stopTask(task.id);
    });
  });

  describe("startAllTasks", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("should start all enabled tasks", async () => {
      const t1 = createTask({ server_id: serverId, name: "T1", type: "backup", schedule: "*/30 * * * *" });
      const t2 = createTask({ server_id: serverId, name: "T2", type: "restart", schedule: "*/30 * * * *" });
      updateTask(t2.id, { enabled: false });
      const executor = vi.fn().mockResolvedValue(undefined);
      startAllTasks(executor);
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);
      expect(executor).toHaveBeenCalledTimes(1);
      stopTask(t1.id);
    });
  });
});
