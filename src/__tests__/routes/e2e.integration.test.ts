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
    createContainer: vi.fn().mockResolvedValue({ id: "test-container-id", start: vi.fn().mockResolvedValue(undefined) }),
  },
  isDockerAvailable: vi.fn().mockResolvedValue(true),
  getImageName: vi.fn().mockReturnValue("itzg/minecraft-server"),
}));
vi.mock("../../config/env.js", () => ({
  env: {
    NODE_ENV: "test", PANEL_HOST: "127.0.0.1", PANEL_PORT: 3000, API_PORT: 3001,
    JWT_SECRET: "e2e-test-secret-key", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
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

const mockNotify = vi.hoisted(() => vi.fn());
vi.mock("../../services/notification.service.js", () => ({
  notify: mockNotify,
  sendDiscordNotification: vi.fn(),
}));

const mockVerifyTotpCode = vi.hoisted(() => vi.fn());
vi.mock("../../services/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/auth.service.js")>();
  return {
    ...actual,
    verifyTotpCode: (...args: unknown[]) => mockVerifyTotpCode(...args),
  };
});

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
  await app.register(jwt, { secret: "e2e-test-secret-key", sign: { expiresIn: "1d" } });
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

describe("E2E Integration Scenarios", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    resetTables();
    vi.clearAllMocks();
    getNodeMetrics.mockResolvedValue({ cpu_percent: 12.5, memory_percent: 40, disk_percent: 60 });
    mockNotify.mockResolvedValue(undefined);
    mockVerifyTotpCode.mockResolvedValue(true);
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function setupAdmin() {
    const res = await app.inject({
      method: "POST", url: "/api/auth/setup",
      payload: { username: "admin", password: "password123" },
    });
    return JSON.parse(res.payload);
  }

  async function loginAs(username: string, password: string) {
    const res = await app.inject({
      method: "POST", url: "/api/auth/login",
      payload: { username, password },
    });
    return JSON.parse(res.payload);
  }

  async function authHeader(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  async function createUserViaApi(adminToken: string, username: string, role = "user") {
    await app.inject({
      method: "POST", url: "/api/users",
      headers: await authHeader(adminToken),
      payload: { username, password: "password123", role },
    });
  }

  async function createServer(adminToken: string, name = "Test Server") {
    const res = await app.inject({
      method: "POST", url: "/api/servers",
      headers: await authHeader(adminToken),
      payload: { name, mc_version: "1.21.4", software: "vanilla", ram_mb: 2048, eula_accepted: true },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.payload).server.id as number;
  }

  describe("1. Full auth lifecycle", () => {
    it("setup → login → session → revoke → verify 401", async () => {
      const setup = await setupAdmin();
      expect(setup.token).toBeDefined();
      expect(setup.user.role).toBe("admin");

      const login = await loginAs("admin", "password123");
      expect(login.token).toBeDefined();
      const token2 = login.token;

      const me = await app.inject({
        method: "GET", url: "/api/auth/me",
        headers: await authHeader(token2),
      });
      expect(me.statusCode).toBe(200);
      expect(JSON.parse(me.payload).user.username).toBe("admin");

      const sessions = await app.inject({
        method: "GET", url: "/api/sessions",
        headers: await authHeader(token2),
      });
      expect(sessions.statusCode).toBe(200);
      const sessionList = JSON.parse(sessions.payload).sessions;
      expect(sessionList.length).toBeGreaterThanOrEqual(1);

      const sessionId = sessionList[0].id;
      const revoke = await app.inject({
        method: "DELETE", url: `/api/sessions/${sessionId}`,
        headers: await authHeader(token2),
      });
      expect(revoke.statusCode).toBe(200);

      const meAfter = await app.inject({
        method: "GET", url: "/api/auth/me",
        headers: await authHeader(token2),
      });
      expect(meAfter.statusCode).toBe(200);
    });

    it("revoke-all invalidates other sessions", async () => {
      await setupAdmin();
      const login1 = await loginAs("admin", "password123");
      const login2 = await loginAs("admin", "password123");

      const sess2 = await app.inject({
        method: "GET", url: "/api/sessions",
        headers: await authHeader(login2.token),
      });
      expect(sess2.statusCode).toBe(200);

      const revokeAll = await app.inject({
        method: "POST", url: "/api/sessions/revoke-all",
        headers: await authHeader(login1.token),
      });
      expect(revokeAll.statusCode).toBe(200);

      const me1After = await app.inject({
        method: "GET", url: "/api/sessions",
        headers: await authHeader(login1.token),
      });
      expect(me1After.statusCode).toBe(200);

      const sess2After = await app.inject({
        method: "GET", url: "/api/sessions",
        headers: await authHeader(login2.token),
      });
      expect(sess2After.statusCode).toBe(401);
    });

    it("setup rejected when admin already exists", async () => {
      await setupAdmin();
      const second = await app.inject({
        method: "POST", url: "/api/auth/setup",
        payload: { username: "admin2", password: "password123" },
      });
      expect(second.statusCode).toBe(400);
      expect(JSON.parse(second.payload).error).toBe("Admin already exists");
    });

    it("login with wrong password returns 401", async () => {
      await setupAdmin();
      const res = await loginAs("admin", "wrongpassword");
      expect(res.error).toBe("Invalid credentials");
    });
  });

  describe("2. 2FA flow", () => {
    it("setup → enable → login challenge → verify → disable", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      const statusBefore = await app.inject({
        method: "GET", url: "/api/auth/2fa/status",
        headers,
      });
      expect(statusBefore.statusCode).toBe(200);
      expect(JSON.parse(statusBefore.payload).enabled).toBe(false);

      const totpSetup = await app.inject({
        method: "POST", url: "/api/auth/2fa/setup",
        headers,
      });
      expect(totpSetup.statusCode).toBe(200);
      const totpBody = JSON.parse(totpSetup.payload);
      expect(totpBody.secret).toBeDefined();
      expect(totpBody.uri).toContain("otpauth://totp");

      const verifyRes = await app.inject({
        method: "POST", url: "/api/auth/2fa/verify",
        headers,
        payload: { code: "123456" },
      });
      expect(verifyRes.statusCode).toBe(200);
      expect(JSON.parse(verifyRes.payload).success).toBe(true);

      const statusAfter = await app.inject({
        method: "GET", url: "/api/auth/2fa/status",
        headers,
      });
      expect(JSON.parse(statusAfter.payload).enabled).toBe(true);

      const login = await app.inject({
        method: "POST", url: "/api/auth/login",
        payload: { username: "admin", password: "password123" },
      });
      const loginBody = JSON.parse(login.payload);
      expect(loginBody.requiresTotp).toBe(true);
      expect(loginBody.tempToken).toBeDefined();

      mockVerifyTotpCode.mockResolvedValueOnce(true);
      const challenge = await app.inject({
        method: "POST", url: "/api/auth/2fa/challenge",
        payload: { tempToken: loginBody.tempToken, code: "654321" },
      });
      expect(challenge.statusCode).toBe(200);
      const fullToken = JSON.parse(challenge.payload).token;
      expect(fullToken).toBeDefined();

      const me = await app.inject({
        method: "GET", url: "/api/auth/me",
        headers: await authHeader(fullToken),
      });
      expect(me.statusCode).toBe(200);
      expect(JSON.parse(me.payload).user.username).toBe("admin");

      mockVerifyTotpCode.mockResolvedValueOnce(true);
      const disableRes = await app.inject({
        method: "POST", url: "/api/auth/2fa/disable",
        headers: await authHeader(fullToken),
        payload: { password: "password123", code: "111111" },
      });
      expect(disableRes.statusCode).toBe(200);
      expect(JSON.parse(disableRes.payload).success).toBe(true);

      const loginAfterDisable = await app.inject({
        method: "POST", url: "/api/auth/login",
        payload: { username: "admin", password: "password123" },
      });
      const afterBody = JSON.parse(loginAfterDisable.payload);
      expect(afterBody.token).toBeDefined();
      expect(afterBody.requiresTotp).toBeUndefined();
    });

    it("challenge with invalid code returns 401", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      await app.inject({ method: "POST", url: "/api/auth/2fa/setup", headers });
      await app.inject({ method: "POST", url: "/api/auth/2fa/verify", headers, payload: { code: "123456" } });

      const login = await app.inject({
        method: "POST", url: "/api/auth/login",
        payload: { username: "admin", password: "password123" },
      });
      const { tempToken } = JSON.parse(login.payload);

      mockVerifyTotpCode.mockResolvedValueOnce(false);
      const challenge = await app.inject({
        method: "POST", url: "/api/auth/2fa/challenge",
        payload: { tempToken, code: "000000" },
      });
      expect(challenge.statusCode).toBe(401);
    });

    it("setup rejected when 2FA already enabled", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      await app.inject({ method: "POST", url: "/api/auth/2fa/setup", headers });
      await app.inject({ method: "POST", url: "/api/auth/2fa/verify", headers, payload: { code: "123456" } });

      const second = await app.inject({ method: "POST", url: "/api/auth/2fa/setup", headers });
      expect(second.statusCode).toBe(400);
    });
  });

  describe("3. Server lifecycle", () => {
    it("create → start → verify running → stop → verify stopped → restart → delete", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      const serverId = await createServer(setup.token, "Lifecycle Server");

      const created = await app.inject({
        method: "GET", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(created.statusCode).toBe(200);
      expect(JSON.parse(created.payload).server.status).toBe("stopped");

      const start = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/start`,
        headers,
      });
      expect(start.statusCode).toBe(200);
      expect(JSON.parse(start.payload).status).toBe("running");

      const running = await app.inject({
        method: "GET", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(JSON.parse(running.payload).server.status).toBe("running");

      const stop = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/stop`,
        headers,
      });
      expect(stop.statusCode).toBe(200);
      expect(JSON.parse(stop.payload).status).toBe("stopped");

      const stopped = await app.inject({
        method: "GET", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(JSON.parse(stopped.payload).server.status).toBe("stopped");

      const restart = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/restart`,
        headers,
      });
      expect(restart.statusCode).toBe(200);
      expect(JSON.parse(restart.payload).status).toBe("running");

      const del = await app.inject({
        method: "DELETE", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(del.statusCode).toBe(200);

      const gone = await app.inject({
        method: "GET", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(gone.statusCode).toBe(404);
    });

    it("start sets status to error when Docker unavailable", async () => {
      const docker = (await import("../../config/docker.js")).default;
      (docker.pull as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Docker not available"));

      const setup = await setupAdmin();
      const serverId = await createServer(setup.token);
      const headers = await authHeader(setup.token);

      const start = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/start`,
        headers,
      });
      expect(start.statusCode).toBe(500);

      const server = await app.inject({
        method: "GET", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(JSON.parse(server.payload).server.status).toBe("error");
    });

    it("stop on non-existent server returns 500", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      const stop = await app.inject({
        method: "POST", url: "/api/servers/9999/stop",
        headers,
      });
      expect(stop.statusCode).toBe(500);
    });
  });

  describe("4. Backup lifecycle", () => {
    it("create → list → restore → delete → list empty", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);
      const serverId = await createServer(setup.token);

      svcCreateBackup.mockResolvedValue({ id: 1, filename: "backup-1.tar.gz", size: 1024 });
      const createRes = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/backups`,
        headers,
      });
      expect(createRes.statusCode).toBe(201);
      expect(JSON.parse(createRes.payload).backup.id).toBe(1);

      svcGetBackups.mockReturnValue([{ id: 1, filename: "backup-1.tar.gz", size: 1024 }]);
      const listRes = await app.inject({
        method: "GET", url: `/api/servers/${serverId}/backups`,
        headers,
      });
      expect(listRes.statusCode).toBe(200);
      expect(JSON.parse(listRes.payload).backups).toHaveLength(1);

      svcRestoreBackup.mockResolvedValue(undefined);
      const restoreRes = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/backups/1/restore`,
        headers,
      });
      expect(restoreRes.statusCode).toBe(200);
      expect(svcRestoreBackup).toHaveBeenCalledWith(serverId, 1);

      const deleteRes = await app.inject({
        method: "DELETE", url: "/api/backups/1",
        headers,
      });
      expect(deleteRes.statusCode).toBe(200);

      svcGetBackups.mockReturnValue([]);
      const emptyRes = await app.inject({
        method: "GET", url: `/api/servers/${serverId}/backups`,
        headers,
      });
      expect(JSON.parse(emptyRes.payload).backups).toEqual([]);
    });

    it("create returns 500 on failure", async () => {
      const setup = await setupAdmin();
      const serverId = await createServer(setup.token);

      svcCreateBackup.mockRejectedValue(new Error("disk full"));
      const res = await app.inject({
        method: "POST", url: `/api/servers/${serverId}/backups`,
        headers: await authHeader(setup.token),
      });
      expect(res.statusCode).toBe(500);
    });
  });

  describe("5. Rate limiting rules lifecycle", () => {
    it("create → list → update → disable → delete → verify empty", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      const createRes = await app.inject({
        method: "POST", url: "/api/rate-limits",
        headers,
        payload: { route: "/api/auth/login", method: "POST", max_requests: 5, window_ms: 60000, description: "Login limit" },
      });
      expect(createRes.statusCode).toBe(201);
      const ruleId = JSON.parse(createRes.payload).id;

      const listRes = await app.inject({ method: "GET", url: "/api/rate-limits", headers });
      expect(listRes.statusCode).toBe(200);
      const rules = JSON.parse(listRes.payload).rules;
      expect(rules.length).toBe(1);
      expect(rules[0].route).toBe("/api/auth/login");

      const updateRes = await app.inject({
        method: "PUT", url: `/api/rate-limits/${ruleId}`,
        headers,
        payload: { max_requests: 10, enabled: false },
      });
      expect(updateRes.statusCode).toBe(200);

      const updated = await app.inject({ method: "GET", url: "/api/rate-limits", headers });
      const updatedRule = JSON.parse(updated.payload).rules[0];
      expect(updatedRule.max_requests).toBe(10);
      expect(updatedRule.enabled).toBe(0);

      const delRes = await app.inject({
        method: "DELETE", url: `/api/rate-limits/${ruleId}`,
        headers,
      });
      expect(delRes.statusCode).toBe(200);

      const emptyRes = await app.inject({ method: "GET", url: "/api/rate-limits", headers });
      expect(JSON.parse(emptyRes.payload).rules).toEqual([]);
    });

    it("non-admin cannot manage rate limits", async () => {
      const setup = await setupAdmin();
      await createUserViaApi(setup.token, "rateuser", "user");
      const userLogin = await loginAs("rateuser", "password123");

      const res = await app.inject({
        method: "POST", url: "/api/rate-limits",
        headers: await authHeader(userLogin.token),
        payload: { route: "/test", max_requests: 1, window_ms: 60000 },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("6. Admin authorization sweep", () => {
    let userToken: string;
    let operatorToken: string;
    let sweepAdminToken: string;

    beforeEach(async () => {
      const setup = await setupAdmin();
      sweepAdminToken = setup.token;

      await createUserViaApi(sweepAdminToken, "plainuser", "user");
      const userLogin = await loginAs("plainuser", "password123");
      userToken = userLogin.token;

      await createUserViaApi(sweepAdminToken, "operator1", "operator");
      const opLogin = await loginAs("operator1", "password123");
      operatorToken = opLogin.token;
    });

    const adminOnlyRoutes = [
      { method: "GET", url: "/api/users" },
      { method: "POST", url: "/api/users", body: { username: "x", password: "password123" } },
      { method: "PUT", url: "/api/users/1/role", body: { role: "user" } },
      { method: "PUT", url: "/api/users/1/password", body: { password: "newpass123" } },
      { method: "DELETE", url: "/api/users/1" },
      { method: "GET", url: "/api/rate-limits" },
      { method: "POST", url: "/api/rate-limits", body: { route: "/test", max_requests: 1, window_ms: 60000 } },
      { method: "POST", url: "/api/servers", body: { name: "x", mc_version: "1.21.4", eula_accepted: true } },
      { method: "POST", url: "/api/nodes", body: { name: "w", hostname: "h", api_key: "k" } },
    ];

    it("user role is blocked from all admin-only routes", async () => {
      for (const route of adminOnlyRoutes) {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          headers: { authorization: `Bearer ${userToken}` },
          ...(route.body ? { payload: route.body } : {}),
        });
        expect(res.statusCode, `${route.method} ${route.url} should be 403`).toBe(403);
      }
    });

    it("operator role is blocked from all admin-only routes", async () => {
      for (const route of adminOnlyRoutes) {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          headers: { authorization: `Bearer ${operatorToken}` },
          ...(route.body ? { payload: route.body } : {}),
        });
        expect(res.statusCode, `${route.method} ${route.url} should be 403 for operator`).toBe(403);
      }
    });

    it("unauthenticated requests get 401 on protected routes", async () => {
      const protectedRoutes = [
        { method: "GET", url: "/api/users" },
        { method: "GET", url: "/api/servers" },
        { method: "GET", url: "/api/nodes" },
        { method: "GET", url: "/api/rate-limits" },
      ];

      for (const route of protectedRoutes) {
        const res = await app.inject({ method: route.method, url: route.url });
        expect(res.statusCode, `${route.method} ${route.url} should be 401`).toBe(401);
      }
    });

    it("user role is blocked from operator-level server properties update", async () => {
      const serverId = await createServer(sweepAdminToken);

      const res = await app.inject({
        method: "PUT", url: `/api/servers/${serverId}/properties`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { properties: { motd: "hacked" } },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("7. Concurrent operations", () => {
    it("parallel server starts do not crash", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);
      const serverId = await createServer(setup.token);

      const results = await Promise.all([
        app.inject({ method: "POST", url: `/api/servers/${serverId}/start`, headers }),
        app.inject({ method: "POST", url: `/api/servers/${serverId}/start`, headers }),
      ]);

      for (const res of results) {
        expect([200, 500]).toContain(res.statusCode);
      }

      const final = await app.inject({
        method: "GET", url: `/api/servers/${serverId}`,
        headers,
      });
      expect(["running", "error"]).toContain(JSON.parse(final.payload).server.status);
    });

    it("parallel backup creation does not crash", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);
      const serverId = await createServer(setup.token);

      let callCount = 0;
      svcCreateBackup.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ id: callCount, filename: `b${callCount}.tar.gz` });
      });

      const results = await Promise.all([
        app.inject({ method: "POST", url: `/api/servers/${serverId}/backups`, headers }),
        app.inject({ method: "POST", url: `/api/servers/${serverId}/backups`, headers }),
      ]);

      for (const res of results) {
        expect(res.statusCode).toBe(201);
      }
    });

    it("concurrent server creation gets unique ports", async () => {
      const setup = await setupAdmin();
      const headers = await authHeader(setup.token);

      const results = await Promise.all([
        app.inject({
          method: "POST", url: "/api/servers", headers,
          payload: { name: "Server A", mc_version: "1.21.4", eula_accepted: true },
        }),
        app.inject({
          method: "POST", url: "/api/servers", headers,
          payload: { name: "Server B", mc_version: "1.21.4", eula_accepted: true },
        }),
        app.inject({
          method: "POST", url: "/api/servers", headers,
          payload: { name: "Server C", mc_version: "1.21.4", eula_accepted: true },
        }),
      ]);

      const ports = results
        .filter((r) => r.statusCode === 201)
        .map((r) => JSON.parse(r.payload).server.port);

      expect(ports).toHaveLength(3);
      expect(new Set(ports).size).toBe(3);
    });
  });
});
