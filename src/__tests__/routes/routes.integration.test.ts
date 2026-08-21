import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { TEST_SCHEMA_SQL } from "../schema.js";

const testDb = vi.hoisted(() => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
});

vi.mock("../../middleware/rate-limit.js", () => ({
  rateLimit: () => async () => {},
  loadRateLimits: vi.fn(),
}));
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
    JWT_SECRET: "integration-test-secret-key", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
    DOCKER_IMAGE: "itzg/minecraft-server", SERVER_PORT_RANGE_START: 25565,
    SERVER_PORT_RANGE_END: 25665, NODE_NAME: "master", NODE_API_KEY: "test-key", GRPC_PORT: 50051,
  },
}));

const execInContainer = vi.hoisted(() => vi.fn());
const writeInContainer = vi.hoisted(() => vi.fn());
vi.mock("../../utils/container.js", () => ({ execInContainer, writeInContainer }));

const searchMods = vi.hoisted(() => vi.fn());
const searchPlugins = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const getProjectVersions = vi.hoisted(() => vi.fn());
const downloadMod = vi.hoisted(() => vi.fn());
vi.mock("../../services/modrinth.service.js", () => ({
  searchMods, searchPlugins, getProject, getProjectVersions, downloadMod,
}));

const getNodeMetrics = vi.hoisted(() => vi.fn());
vi.mock("../../services/metrics.service.js", () => ({
  getNodeMetrics,
  getServerMetrics: vi.fn(),
  getMetricsHistory: vi.fn(() => []),
  collectMetrics: vi.fn(),
  collectAllMetrics: vi.fn(),
}));

const svcGetBackups = vi.hoisted(() => vi.fn());
const svcCreateBackup = vi.hoisted(() => vi.fn());
const svcRestoreBackup = vi.hoisted(() => vi.fn());
const svcDeleteBackup = vi.hoisted(() => vi.fn());
vi.mock("../../services/backup.service.js", () => ({
  getBackups: svcGetBackups,
  createBackup: svcCreateBackup,
  restoreBackup: svcRestoreBackup,
  deleteBackup: svcDeleteBackup,
}));

const svcGetAllTasks = vi.hoisted(() => vi.fn());
const svcGetTasksForServer = vi.hoisted(() => vi.fn());
const svcGetTaskById = vi.hoisted(() => vi.fn());
const svcCreateTask = vi.hoisted(() => vi.fn());
const svcUpdateTask = vi.hoisted(() => vi.fn());
const svcDeleteTask = vi.hoisted(() => vi.fn());
const svcStartTask = vi.hoisted(() => vi.fn());
const svcStopTask = vi.hoisted(() => vi.fn());
vi.mock("../../services/schedule.service.js", () => ({
  getAllTasks: svcGetAllTasks,
  getTasksForServer: svcGetTasksForServer,
  getTaskById: svcGetTaskById,
  createTask: svcCreateTask,
  updateTask: svcUpdateTask,
  deleteTask: svcDeleteTask,
  startTask: svcStartTask,
  stopTask: svcStopTask,
}));

const testCloudConnection = vi.hoisted(() => vi.fn());
const downloadFromCloud = vi.hoisted(() => vi.fn());
vi.mock("../../services/cloud-storage.service.js", () => ({
  testCloudConnection,
  downloadFromCloud,
  uploadBackupToCloud: vi.fn(),
  deleteFromCloud: vi.fn(),
  createCloudProvider: vi.fn(),
}));

testDb.exec(TEST_SCHEMA_SQL);

const [
  { default: authRoutes },
  { default: serverRoutes },
  { default: backupRoutes },
  { default: cloudStorageRoutes },
  { default: fileRoutes },
  { default: modRoutes },
  { default: nodeRoutes },
  { default: notificationRoutes },
  { default: overviewRoutes },
  { default: playerRoutes },
  { default: rateLimitRoutes },
  { default: scheduleRoutes },
  { default: sessionRoutes },
  { default: templateRoutes },
  { default: userRoutes },
] = await Promise.all([
  import("../../routes/auth.js"),
  import("../../routes/servers.js"),
  import("../../routes/backups.js"),
  import("../../routes/cloud-storage.js"),
  import("../../routes/files.js"),
  import("../../routes/mods.js"),
  import("../../routes/nodes.js"),
  import("../../routes/notifications.js"),
  import("../../routes/overview.js"),
  import("../../routes/players.js"),
  import("../../routes/rate-limits.js"),
  import("../../routes/schedule.js"),
  import("../../routes/sessions.js"),
  import("../../routes/templates.js"),
  import("../../routes/users.js"),
]);

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(jwt, { secret: "integration-test-secret-key", sign: { expiresIn: "1d" } });
  await app.register(multipart);
  await app.register(authRoutes);
  await app.register(serverRoutes);
  await app.register(backupRoutes);
  await app.register(cloudStorageRoutes);
  await app.register(fileRoutes);
  await app.register(modRoutes);
  await app.register(nodeRoutes);
  await app.register(notificationRoutes);
  await app.register(overviewRoutes);
  await app.register(playerRoutes);
  await app.register(rateLimitRoutes);
  await app.register(scheduleRoutes);
  await app.register(sessionRoutes);
  await app.register(templateRoutes);
  await app.register(userRoutes);
  return app;
}

function resetTables() {
  testDb.exec(`
    DELETE FROM backup_uploads;
    DELETE FROM cloud_storage_configs;
    DELETE FROM installed_mods;
    DELETE FROM scheduled_tasks;
    DELETE FROM backups;
    DELETE FROM server_config;
    DELETE FROM sessions;
    DELETE FROM failed_logins;
    DELETE FROM notifications;
    DELETE FROM rate_limits;
    DELETE FROM users;
    DELETE FROM servers;
    DELETE FROM nodes;
    DELETE FROM sqlite_sequence;
  `);
  testDb.prepare("INSERT INTO nodes (name, hostname, port, status, api_key, max_servers) VALUES (?, ?, ?, ?, ?, ?)")
    .run("master", "127.0.0.1", 50051, "online", "test-key", 10);
}

describe("All Routes Integration", () => {
  let app: ReturnType<typeof Fastify>;
  let adminToken: string;
  let userToken: string;
  let adminId: number;
  let userId: number;

  beforeEach(async () => {
    resetTables();
    vi.clearAllMocks();
    getNodeMetrics.mockResolvedValue({ cpu_percent: 12.5, memory_percent: 40, disk_percent: 60 });
    app = await buildApp();
    await app.ready();
    const setupRes = await app.inject({
      method: "POST", url: "/api/auth/setup",
      payload: { username: "admin", password: "password123" },
    });
    const setupBody = JSON.parse(setupRes.payload);
    adminToken = setupBody.token;
    adminId = setupBody.user.id;
    await app.inject({
      method: "POST", url: "/api/users", headers: { authorization: `Bearer ${adminToken}` },
      payload: { username: "plainuser", password: "password123", role: "user" },
    });
    const loginRes = await app.inject({
      method: "POST", url: "/api/auth/login",
      payload: { username: "plainuser", password: "password123" },
    });
    userToken = JSON.parse(loginRes.payload).token;
    userId = JSON.parse(loginRes.payload).user.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const admin = () => ({ authorization: `Bearer ${adminToken}` });
  const plain = () => ({ authorization: `Bearer ${userToken}` });

  async function createServer(name = "Test Server") {
    const res = await app.inject({
      method: "POST", url: "/api/servers", headers: admin(),
      payload: { name, mc_version: "1.21.4", software: "vanilla", ram_mb: 2048, eula_accepted: true },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.payload).server.id as number;
  }

  describe("Auth session expiry", () => {
    it("exposes expiresAt and a clean user object from /api/auth/me", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: admin() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.expiresAt).toBeTypeOf("number");
      expect(body.expiresAt).toBeGreaterThan(Date.now());
      expect(body.user).toEqual({ id: adminId, username: "admin", role: "admin" });
    });
  });

  describe("Users API", () => {
    it("lists users for admin", async () => {
      const res = await app.inject({ method: "GET", url: "/api/users", headers: admin() });
      expect(res.statusCode).toBe(200);
      const names = JSON.parse(res.payload).users.map((u: { username: string }) => u.username);
      expect(names).toContain("admin");
      expect(names).toContain("plainuser");
    });

    it("rejects non-admin with 403", async () => {
      const res = await app.inject({ method: "GET", url: "/api/users", headers: plain() });
      expect(res.statusCode).toBe(403);
    });

    it("rejects duplicate username", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/users", headers: admin(),
        payload: { username: "admin", password: "password123" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when changing role of missing user", async () => {
      const res = await app.inject({
        method: "PUT", url: "/api/users/9999/role", headers: admin(),
        payload: { role: "user" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when changing password of missing user", async () => {
      const res = await app.inject({
        method: "PUT", url: "/api/users/9999/password", headers: admin(),
        payload: { password: "newpass123" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("prevents deleting yourself", async () => {
      const res = await app.inject({ method: "DELETE", url: `/api/users/${adminId}`, headers: admin() });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("Cannot delete yourself");
    });

    it("deletes another user", async () => {
      const res = await app.inject({ method: "DELETE", url: `/api/users/${userId}`, headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).success).toBe(true);
    });
  });

  describe("Sessions API", () => {
    it("lists sessions for current user", async () => {
      const res = await app.inject({ method: "GET", url: "/api/sessions", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).sessions.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 404 for unknown session id", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/sessions/9999", headers: admin() });
      expect(res.statusCode).toBe(404);
    });

    it("revokes all sessions except current", async () => {
      const res = await app.inject({ method: "POST", url: "/api/sessions/revoke-all", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).success).toBe(true);
      const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: admin() });
      expect(me.statusCode).toBe(200);
    });
  });

  describe("Nodes API", () => {
    it("lists nodes including master", async () => {
      const res = await app.inject({ method: "GET", url: "/api/nodes", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).nodes[0].name).toBe("master");
    });

    it("gets node by id and 404 for unknown", async () => {
      const ok = await app.inject({ method: "GET", url: "/api/nodes/1", headers: admin() });
      expect(ok.statusCode).toBe(200);
      const missing = await app.inject({ method: "GET", url: "/api/nodes/9999", headers: admin() });
      expect(missing.statusCode).toBe(404);
    });

    it("lists servers for node", async () => {
      const res = await app.inject({ method: "GET", url: "/api/nodes/1/servers", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).servers).toEqual([]);
    });

    it("creates node as admin, rejects non-admin", async () => {
      const forbidden = await app.inject({
        method: "POST", url: "/api/nodes", headers: plain(),
        payload: { name: "worker", hostname: "10.0.0.5", api_key: "key2" },
      });
      expect(forbidden.statusCode).toBe(403);

      const res = await app.inject({
        method: "POST", url: "/api/nodes", headers: admin(),
        payload: { name: "worker", hostname: "10.0.0.5", api_key: "key2" },
      });
      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).node.name).toBe("worker");
    });

    it("refuses to delete master but deletes other nodes", async () => {
      const master = await app.inject({ method: "DELETE", url: "/api/nodes/1", headers: admin() });
      expect(master.statusCode).toBe(400);

      await app.inject({
        method: "POST", url: "/api/nodes", headers: admin(),
        payload: { name: "worker", hostname: "10.0.0.5", api_key: "key2" },
      });
      const workerId = JSON.parse((await app.inject({ method: "GET", url: "/api/nodes", headers: admin() })).payload)
        .nodes.find((n: { name: string }) => n.name === "worker").id;
      const res = await app.inject({ method: "DELETE", url: `/api/nodes/${workerId}`, headers: admin() });
      expect(res.statusCode).toBe(200);
    });

    it("accepts heartbeat by node id", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/nodes/1/heartbeat", headers: admin(),
        payload: { metrics: { cpu_percent: 5 } },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).success).toBe(true);
    });

    it("accepts agent heartbeat and 404s unknown node", async () => {
      const ok = await app.inject({
        method: "POST", url: "/api/nodes/heartbeat", headers: admin(),
        payload: { name: "1", api_key: "test-key", metrics: { cpu_percent: 5 } },
      });
      expect(ok.statusCode).toBe(200);
      const missing = await app.inject({
        method: "POST", url: "/api/nodes/heartbeat", headers: admin(),
        payload: { name: "9999", api_key: "test-key" },
      });
      expect(missing.statusCode).toBe(404);
    });

    it("returns node metrics and find-for-server", async () => {
      const metrics = await app.inject({ method: "GET", url: "/api/nodes/metrics", headers: admin() });
      expect(metrics.statusCode).toBe(200);
      expect(JSON.parse(metrics.payload).metrics.cpu_percent).toBe(12.5);

      const find = await app.inject({ method: "POST", url: "/api/nodes/find-for-server", headers: admin() });
      expect(find.statusCode).toBe(200);
      expect(JSON.parse(find.payload).node.name).toBe("master");
    });
  });

  describe("Overview API", () => {
    it("returns nodes and metrics", async () => {
      const res = await app.inject({ method: "GET", url: "/api/overview", headers: admin() });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.nodes[0].name).toBe("master");
      expect(body.metrics.memory_percent).toBe(40);
    });

    it("requires auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/overview" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("Templates API", () => {
    it("lists templates and gets one by id", async () => {
      const list = await app.inject({ method: "GET", url: "/api/templates", headers: admin() });
      expect(list.statusCode).toBe(200);
      const templates = JSON.parse(list.payload).templates;
      expect(templates.length).toBeGreaterThan(0);

      const one = await app.inject({ method: "GET", url: `/api/templates/${templates[0].id}`, headers: admin() });
      expect(one.statusCode).toBe(200);
      expect(JSON.parse(one.payload).template.id).toBe(templates[0].id);
    });

    it("returns 404 for unknown template", async () => {
      const res = await app.inject({ method: "GET", url: "/api/templates/does-not-exist", headers: admin() });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("Notifications API", () => {
    it("creates, lists and deletes notifications", async () => {
      const empty = await app.inject({ method: "GET", url: "/api/notifications", headers: admin() });
      expect(empty.statusCode).toBe(200);
      expect(JSON.parse(empty.payload).notifications).toEqual([]);

      const create = await app.inject({
        method: "POST", url: "/api/notifications", headers: admin(),
        payload: { type: "discord", webhook_url: "https://example.com/hook", events: ["backup.completed"] },
      });
      expect(create.statusCode).toBe(201);

      const del = await app.inject({ method: "DELETE", url: "/api/notifications/1", headers: admin() });
      expect(del.statusCode).toBe(200);
    });

    it("validates notification payload", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/notifications", headers: admin(),
        payload: { type: "carrier-pigeon", events: ["x"] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("sends test notification via webhook", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      try {
        const res = await app.inject({
          method: "POST", url: "/api/notifications/test", headers: admin(),
          payload: { webhook_url: "https://example.com/hook" },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.payload).success).toBe(true);
        expect(fetchMock).toHaveBeenCalledOnce();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("returns 502 when webhook fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
      try {
        const res = await app.inject({
          method: "POST", url: "/api/notifications/test", headers: admin(),
          payload: { webhook_url: "https://example.com/hook" },
        });
        expect(res.statusCode).toBe(502);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("Rate Limits API", () => {
    it("rejects non-admin with 403", async () => {
      const res = await app.inject({ method: "GET", url: "/api/rate-limits", headers: plain() });
      expect(res.statusCode).toBe(403);
    });

    it("creates, updates and deletes rules", async () => {
      const empty = await app.inject({ method: "GET", url: "/api/rate-limits", headers: admin() });
      expect(JSON.parse(empty.payload).rules).toEqual([]);

      const create = await app.inject({
        method: "POST", url: "/api/rate-limits", headers: admin(),
        payload: { route: "/api/auth/login", max_requests: 5, window_ms: 60000 },
      });
      expect(create.statusCode).toBe(201);
      const id = JSON.parse(create.payload).id;

      const update = await app.inject({
        method: "PUT", url: `/api/rate-limits/${id}`, headers: admin(),
        payload: { enabled: false },
      });
      expect(update.statusCode).toBe(200);

      const del = await app.inject({ method: "DELETE", url: `/api/rate-limits/${id}`, headers: admin() });
      expect(del.statusCode).toBe(200);
    });

    it("returns 404 for unknown rule on update and delete", async () => {
      const upd = await app.inject({
        method: "PUT", url: "/api/rate-limits/9999", headers: admin(),
        payload: { enabled: false },
      });
      expect(upd.statusCode).toBe(404);
      const del = await app.inject({ method: "DELETE", url: "/api/rate-limits/9999", headers: admin() });
      expect(del.statusCode).toBe(404);
    });
  });

  describe("Backups API", () => {
    it("lists backups", async () => {
      const serverId = await createServer();
      svcGetBackups.mockReturnValue([]);
      const res = await app.inject({ method: "GET", url: `/api/servers/${serverId}/backups`, headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).backups).toEqual([]);
      expect(svcGetBackups).toHaveBeenCalledWith(serverId);
    });

    it("creates a backup", async () => {
      const serverId = await createServer();
      svcCreateBackup.mockResolvedValue({ id: 1, filename: "s1.tar.gz" });
      const res = await app.inject({ method: "POST", url: `/api/servers/${serverId}/backups`, headers: admin() });
      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).backup.id).toBe(1);
    });

    it("returns 500 when backup creation fails", async () => {
      const serverId = await createServer();
      svcCreateBackup.mockRejectedValue(new Error("docker down"));
      const res = await app.inject({ method: "POST", url: `/api/servers/${serverId}/backups`, headers: admin() });
      expect(res.statusCode).toBe(500);
    });

    it("restores a backup", async () => {
      const serverId = await createServer();
      svcRestoreBackup.mockResolvedValue(undefined);
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/backups/1/restore`, headers: admin(),
      });
      expect(res.statusCode).toBe(200);
      expect(svcRestoreBackup).toHaveBeenCalledWith(serverId, 1);
    });

    it("deletes a backup", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/backups/1", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(svcDeleteBackup).toHaveBeenCalledWith(1);
    });

    it("returns 404 when downloading missing backup", async () => {
      const serverId = await createServer();
      const res = await app.inject({
        method: "GET", url: `/api/servers/${serverId}/backups/999/download`, headers: admin(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("Cloud Storage API", () => {
    it("creates config and masks secrets on read", async () => {
      const serverId = await createServer();
      const create = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/cloud-storage`, headers: admin(),
        payload: { provider: "s3", label: "main", config: { bucket: "b", accessKeyId: "AKIA", secretAccessKey: "supersecret" } },
      });
      expect(create.statusCode).toBe(201);

      const list = await app.inject({ method: "GET", url: `/api/servers/${serverId}/cloud-storage`, headers: admin() });
      expect(list.statusCode).toBe(200);
      const cfg = JSON.parse(list.payload).configs[0];
      const parsed = JSON.parse(cfg.config_json);
      expect(parsed.secretAccessKey).toBe("********");
      expect(parsed.bucket).toBe("b");
    });

    it("updates label and returns 404 for unknown config", async () => {
      const serverId = await createServer();
      const create = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/cloud-storage`, headers: admin(),
        payload: { provider: "s3", label: "main", config: {} },
      });
      const configId = JSON.parse(create.payload).id;

      const update = await app.inject({
        method: "PUT", url: `/api/servers/${serverId}/cloud-storage/${configId}`, headers: admin(),
        payload: { label: "renamed" },
      });
      expect(update.statusCode).toBe(200);

      const missing = await app.inject({
        method: "PUT", url: `/api/servers/${serverId}/cloud-storage/9999`, headers: admin(),
        payload: { label: "nope" },
      });
      expect(missing.statusCode).toBe(404);
    });

    it("tests connection and deletes config", async () => {
      const serverId = await createServer();
      const create = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/cloud-storage`, headers: admin(),
        payload: { provider: "s3", label: "main", config: {} },
      });
      const configId = JSON.parse(create.payload).id;

      testCloudConnection.mockResolvedValue(true);
      const test = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/cloud-storage/${configId}/test`, headers: admin(),
      });
      expect(test.statusCode).toBe(200);
      expect(JSON.parse(test.payload).success).toBe(true);

      const del = await app.inject({
        method: "DELETE", url: `/api/servers/${serverId}/cloud-storage/${configId}`, headers: admin(),
      });
      expect(del.statusCode).toBe(200);

      const again = await app.inject({
        method: "DELETE", url: `/api/servers/${serverId}/cloud-storage/${configId}`, headers: admin(),
      });
      expect(again.statusCode).toBe(404);
    });
  });

  describe("Files API", () => {
    it("parses ls output into entries", async () => {
      const serverId = await createServer();
      execInContainer.mockResolvedValueOnce(
        "total 8\ndrwxr-xr-x 2 root root 4096 2026-01-01 10:00 world\n-rw-r--r-- 1 root root 1024 2026-01-01 10:00 server.properties"
      );
      const res = await app.inject({ method: "GET", url: `/api/servers/${serverId}/files`, headers: admin() });
      expect(res.statusCode).toBe(200);
      const entries = JSON.parse(res.payload).entries;
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({ name: "world", isDir: true });
      expect(entries[1]).toMatchObject({ name: "server.properties", isDir: false, size: 1024 });
    });

    it("rejects directory traversal", async () => {
      const serverId = await createServer();
      const res = await app.inject({
        method: "GET", url: `/api/servers/${serverId}/files?path=../../etc`, headers: admin(),
      });
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.payload).error).toContain("traversal");
    });

    it("writes file content and creates directories", async () => {
      const serverId = await createServer();
      writeInContainer.mockResolvedValue("");
      const write = await app.inject({
        method: "PUT", url: `/api/servers/${serverId}/files/content`, headers: admin(),
        payload: { path: "server.properties", content: "motd=hi" },
      });
      expect(write.statusCode).toBe(200);
      expect(writeInContainer).toHaveBeenCalledWith(serverId, ["tee", "/data/server.properties"], "motd=hi");

      execInContainer.mockResolvedValueOnce("");
      const mkdir = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/files/mkdir`, headers: admin(),
        payload: { path: "plugins" },
      });
      expect(mkdir.statusCode).toBe(200);
      expect(execInContainer).toHaveBeenLastCalledWith(serverId, ["mkdir", "-p", "/data/plugins"]);
    });

    it("deletes files", async () => {
      const serverId = await createServer();
      execInContainer.mockResolvedValueOnce("");
      const res = await app.inject({
        method: "DELETE", url: `/api/servers/${serverId}/files?path=old.log`, headers: admin(),
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).success).toBe(true);
    });

    it("reads and writes server.properties", async () => {
      const serverId = await createServer();
      execInContainer.mockResolvedValueOnce("motd=hello\n# a comment\nlevel-type=default");
      const get = await app.inject({ method: "GET", url: `/api/servers/${serverId}/properties`, headers: admin() });
      expect(get.statusCode).toBe(200);
      expect(JSON.parse(get.payload).properties).toEqual({ motd: "hello", "level-type": "default" });

      writeInContainer.mockResolvedValue("");
      execInContainer.mockResolvedValue("");
      const put = await app.inject({
        method: "PUT", url: `/api/servers/${serverId}/properties`, headers: admin(),
        payload: { properties: { motd: "new" }, reload: true },
      });
      expect(put.statusCode).toBe(200);
    });

    it("returns 404 for download from missing server", async () => {
      const res = await app.inject({
        method: "GET", url: "/api/servers/9999/files/download?path=world.zip", headers: admin(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("Players API", () => {
    it("reads whitelist entries", async () => {
      execInContainer.mockResolvedValueOnce('[{"name":"Steve"},{"uuid":"x"}]');
      const res = await app.inject({ method: "GET", url: "/api/servers/1/players/whitelist", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).players).toEqual(["Steve", '{"uuid":"x"}']);
    });

    it("returns empty list when exec fails", async () => {
      execInContainer.mockRejectedValueOnce(new Error("not running"));
      const res = await app.inject({ method: "GET", url: "/api/servers/1/players/whitelist", headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).players).toEqual([]);
    });

    it("adds and removes whitelist players", async () => {
      execInContainer.mockResolvedValueOnce("[]");
      writeInContainer.mockResolvedValue("");
      const add = await app.inject({
        method: "POST", url: "/api/servers/1/players/whitelist", headers: admin(),
        payload: { name: "Steve" },
      });
      expect(add.statusCode).toBe(200);
      const written = JSON.parse(writeInContainer.mock.calls[0][2]);
      expect(written).toEqual([{ name: "Steve" }]);

      execInContainer.mockResolvedValueOnce('[{"name":"Steve"},{"name":"Alex"}]');
      const remove = await app.inject({
        method: "DELETE", url: "/api/servers/1/players/whitelist/steve", headers: admin(),
      });
      expect(remove.statusCode).toBe(200);
      const remaining = JSON.parse(writeInContainer.mock.calls[1][2]);
      expect(remaining).toEqual([{ name: "Alex" }]);
    });

    it("adds op with level 4", async () => {
      execInContainer.mockResolvedValueOnce("[]");
      writeInContainer.mockResolvedValue("");
      const res = await app.inject({
        method: "POST", url: "/api/servers/1/players/ops", headers: admin(),
        payload: { name: "AdminDude" },
      });
      expect(res.statusCode).toBe(200);
      const written = JSON.parse(writeInContainer.mock.calls[0][2]);
      expect(written[0]).toMatchObject({ name: "AdminDude", level: 4 });
    });

    it("adds ban with reason", async () => {
      execInContainer.mockResolvedValueOnce("[]");
      writeInContainer.mockResolvedValue("");
      const res = await app.inject({
        method: "POST", url: "/api/servers/1/players/bans", headers: admin(),
        payload: { name: "Griefer", reason: "griefing" },
      });
      expect(res.statusCode).toBe(200);
      const written = JSON.parse(writeInContainer.mock.calls[0][2]);
      expect(written[0]).toMatchObject({ name: "Griefer", reason: "griefing" });
    });
  });

  describe("Mods API", () => {
    it("searches mods and plugins", async () => {
      searchMods.mockResolvedValue([{ slug: "sodium" }]);
      const mods = await app.inject({
        method: "GET", url: "/api/mods/search?q=sodium", headers: admin(),
      });
      expect(mods.statusCode).toBe(200);
      expect(JSON.parse(mods.payload).mods[0].slug).toBe("sodium");

      searchPlugins.mockResolvedValue([{ slug: "essentialsx" }]);
      const plugins = await app.inject({ method: "GET", url: "/api/mods/plugins?q=ess", headers: admin() });
      expect(plugins.statusCode).toBe(200);
      expect(JSON.parse(plugins.payload).plugins[0].slug).toBe("essentialsx");
    });

    it("gets project and versions, 404 on unknown project", async () => {
      getProject.mockResolvedValue({ slug: "sodium", title: "Sodium" });
      const ok = await app.inject({ method: "GET", url: "/api/mods/sodium", headers: admin() });
      expect(ok.statusCode).toBe(200);

      getProject.mockRejectedValue(new Error("not found"));
      const missing = await app.inject({ method: "GET", url: "/api/mods/nope", headers: admin() });
      expect(missing.statusCode).toBe(404);

      getProjectVersions.mockResolvedValue([{ id: "v1" }]);
      const versions = await app.inject({ method: "GET", url: "/api/mods/sodium/versions", headers: admin() });
      expect(JSON.parse(versions.payload).versions).toHaveLength(1);
    });

    it("lists installed mods as empty when dir missing", async () => {
      const serverId = await createServer();
      const res = await app.inject({ method: "GET", url: `/api/servers/${serverId}/mods`, headers: admin() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).mods).toEqual([]);
    });

    it("installs a mod and records it", async () => {
      const serverId = await createServer();
      downloadMod.mockResolvedValue({ success: true, slug: "sodium", filename: "sodium.jar", version_number: "1.0" });
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/mods/install`, headers: admin(),
        payload: { versionId: "v1" },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).filename).toBe("sodium.jar");
      const row = testDb.prepare("SELECT * FROM installed_mods WHERE server_id = ?").get(serverId) as { slug: string };
      expect(row.slug).toBe("sodium");
    });

    it("returns 500 when install fails", async () => {
      const serverId = await createServer();
      downloadMod.mockResolvedValue({ success: false, error: "download failed" });
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/mods/install`, headers: admin(),
        payload: { versionId: "v1" },
      });
      expect(res.statusCode).toBe(500);
    });

    it("installs mods in batch", async () => {
      const serverId = await createServer();
      downloadMod.mockResolvedValue({ success: true, slug: "s", filename: "m.jar", version_number: "1" });
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/mods/install-batch`, headers: admin(),
        payload: { versionIds: ["v1", "v2"] },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).results).toHaveLength(2);
    });

    it("detects available updates", async () => {
      const serverId = await createServer();
      testDb.prepare("INSERT INTO installed_mods (server_id, slug, mod_name, filename, version) VALUES (?, ?, ?, ?, ?)")
        .run(serverId, "sodium", "Sodium", "sodium-old.jar", "0.5");
      getProjectVersions.mockResolvedValue([{ id: "v9", version_number: "1.0" }]);
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/mods/check-updates`, headers: admin(),
      });
      expect(res.statusCode).toBe(200);
      const updates = JSON.parse(res.payload).updates;
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ slug: "sodium", latestVersion: "1.0", latestVersionId: "v9" });
    });

    it("updates a mod and rejects mods without slug", async () => {
      const serverId = await createServer();
      testDb.prepare("INSERT INTO installed_mods (server_id, slug, mod_name, filename, version) VALUES (?, ?, ?, ?, ?)")
        .run(serverId, "sodium", "Sodium", "sodium-old.jar", "0.5");
      getProjectVersions.mockResolvedValue([{ id: "v9", version_number: "1.0" }]);
      downloadMod.mockResolvedValue({ success: true, slug: "sodium", filename: "sodium-new.jar", version_number: "1.0" });
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/mods/update/sodium-old.jar`, headers: admin(),
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toMatchObject({ filename: "sodium-new.jar", version: "1.0" });

      testDb.prepare("INSERT INTO installed_mods (server_id, mod_name, filename, version) VALUES (?, ?, ?, ?)")
        .run(serverId, "Manual", "manual.jar", "1");
      const noSlug = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/mods/update/manual.jar`, headers: admin(),
      });
      expect(noSlug.statusCode).toBe(400);
    });

    it("returns 500 when deleting a missing mod file", async () => {
      const serverId = await createServer();
      const res = await app.inject({
        method: "DELETE", url: `/api/servers/${serverId}/mods/ghost.jar`, headers: admin(),
      });
      expect(res.statusCode).toBe(500);
    });
  });

  describe("Schedule API", () => {
    it("lists tasks", async () => {
      svcGetAllTasks.mockReturnValue([]);
      const all = await app.inject({ method: "GET", url: "/api/tasks", headers: admin() });
      expect(all.statusCode).toBe(200);
      expect(JSON.parse(all.payload).tasks).toEqual([]);

      const serverId = await createServer();
      svcGetTasksForServer.mockReturnValue([]);
      const perServer = await app.inject({
        method: "GET", url: `/api/servers/${serverId}/tasks`, headers: admin(),
      });
      expect(perServer.statusCode).toBe(200);
    });

    it("creates a task and starts it", async () => {
      const serverId = await createServer();
      svcCreateTask.mockReturnValue({ id: 1, server_id: serverId, name: "nightly", type: "backup", schedule: "0 3 * * *", enabled: 1 });
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/tasks`, headers: admin(),
        payload: { name: "nightly", type: "backup", schedule: "0 3 * * *" },
      });
      expect(res.statusCode).toBe(201);
      expect(svcStartTask).toHaveBeenCalledOnce();
    });

    it("updates a task and 404s unknown tasks", async () => {
      svcGetTaskById.mockReturnValueOnce(undefined);
      const missing = await app.inject({
        method: "PUT", url: "/api/tasks/9999", headers: admin(),
        payload: { name: "x" },
      });
      expect(missing.statusCode).toBe(404);

      const existing = { id: 1, server_id: 1, name: "old", type: "backup", schedule: "0 3 * * *", enabled: 1 };
      svcGetTaskById.mockReturnValueOnce(existing).mockReturnValueOnce({ ...existing, name: "new" });
      const update = await app.inject({
        method: "PUT", url: "/api/tasks/1", headers: admin(),
        payload: { name: "new" },
      });
      expect(update.statusCode).toBe(200);
      expect(JSON.parse(update.payload).task.name).toBe("new");
      expect(svcUpdateTask).toHaveBeenCalledWith(1, { name: "new", schedule: undefined, command: undefined, enabled: undefined });
    });

    it("deletes tasks", async () => {
      svcGetTaskById.mockReturnValueOnce(undefined);
      const missing = await app.inject({ method: "DELETE", url: "/api/tasks/9999", headers: admin() });
      expect(missing.statusCode).toBe(404);

      svcGetTaskById.mockReturnValueOnce({ id: 1 });
      const ok = await app.inject({ method: "DELETE", url: "/api/tasks/1", headers: admin() });
      expect(ok.statusCode).toBe(200);
      expect(svcDeleteTask).toHaveBeenCalledWith(1);
    });

    it("runs a backup task immediately", async () => {
      svcGetTaskById.mockReturnValue({ id: 1, server_id: 1, type: "backup", schedule: "0 3 * * *", enabled: 1 });
      svcCreateBackup.mockResolvedValue({ id: 9 });
      const ok = await app.inject({ method: "POST", url: "/api/tasks/1/run", headers: admin() });
      expect(ok.statusCode).toBe(200);
      expect(svcCreateBackup).toHaveBeenCalledWith(1);

      svcCreateBackup.mockRejectedValue(new Error("fail"));
      const fail = await app.inject({ method: "POST", url: "/api/tasks/1/run", headers: admin() });
      expect(fail.statusCode).toBe(500);
    });
  });
});
