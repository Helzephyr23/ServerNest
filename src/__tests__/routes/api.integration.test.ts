import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";

const testDb = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS nodes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, hostname TEXT NOT NULL, port INTEGER NOT NULL DEFAULT 50051, status TEXT NOT NULL DEFAULT 'offline', api_key TEXT NOT NULL, max_servers INTEGER NOT NULL DEFAULT 10, current_servers INTEGER NOT NULL DEFAULT 0, last_heartbeat TEXT, cpu_percent REAL DEFAULT 0, memory_percent REAL DEFAULT 0, disk_percent REAL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, node_id INTEGER NOT NULL DEFAULT 1, port INTEGER UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'stopped', mc_version TEXT NOT NULL DEFAULT '1.21.4', software TEXT NOT NULL DEFAULT 'vanilla', image TEXT NOT NULL DEFAULT 'itzg/minecraft-server', ram_mb INTEGER NOT NULL DEFAULT 2048, cpu_percent REAL DEFAULT NULL, container_id TEXT, eula_accepted INTEGER NOT NULL DEFAULT 0, eula_accepted_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (node_id) REFERENCES nodes(id));
    CREATE TABLE IF NOT EXISTS server_config (server_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (server_id, key), FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS scheduled_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, schedule TEXT NOT NULL, command TEXT, enabled INTEGER NOT NULL DEFAULT 1, last_run TEXT, next_run TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, webhook_url TEXT, email TEXT, enabled INTEGER NOT NULL DEFAULT 1, events TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS installed_mods (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER NOT NULL, mod_name TEXT NOT NULL, filename TEXT NOT NULL, version TEXT, source TEXT NOT NULL DEFAULT 'modrinth', installed_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE);
  `);
  return db;
});

vi.mock("../../middleware/rate-limit.js", () => ({
  rateLimit: () => async () => {},
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

import authRoutes from "../../routes/auth.js";
import serverRoutes from "../../routes/servers.js";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: "integration-test-secret-key", sign: { expiresIn: "1d" } });
  await app.register(authRoutes);
  await app.register(serverRoutes);
  return app;
}

function resetTables() {
  testDb.exec("DELETE FROM users");
  testDb.exec("DELETE FROM server_config");
  testDb.exec("DELETE FROM backups");
  testDb.exec("DELETE FROM scheduled_tasks");
  testDb.exec("DELETE FROM installed_mods");
  testDb.exec("DELETE FROM servers");
  testDb.exec("DELETE FROM nodes");
  testDb.exec("DELETE FROM sqlite_sequence");
  testDb.prepare("INSERT INTO nodes (name, hostname, port, status, api_key, max_servers) VALUES (?, ?, ?, ?, ?, ?)")
    .run("master", "127.0.0.1", 50051, "online", "test-key", 10);
}

describe("Auth API Integration", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    resetTables();
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/auth/status", () => {
    it("should return firstRun: true initially", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).firstRun).toBe(true);
    });
  });

  describe("POST /api/auth/setup", () => {
    it("should create admin user on first run", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/auth/setup",
        payload: { username: "admin", password: "password123" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.token).toBeDefined();
      expect(body.user.username).toBe("admin");
      expect(body.user.role).toBe("admin");
    });

    it("should reject setup if admin already exists", async () => {
      await app.inject({ method: "POST", url: "/api/auth/setup", payload: { username: "admin", password: "password123" } });
      const res = await app.inject({ method: "POST", url: "/api/auth/setup", payload: { username: "admin2", password: "password123" } });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with correct credentials", async () => {
      await app.inject({ method: "POST", url: "/api/auth/setup", payload: { username: "admin", password: "password123" } });
      const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "password123" } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).token).toBeDefined();
    });

    it("should reject incorrect credentials", async () => {
      await app.inject({ method: "POST", url: "/api/auth/setup", payload: { username: "admin", password: "password123" } });
      const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "wrong" } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user with valid token", async () => {
      const setupRes = await app.inject({ method: "POST", url: "/api/auth/setup", payload: { username: "admin", password: "password123" } });
      const { token } = JSON.parse(setupRes.payload);
      const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).user.username).toBe("admin");
    });

    it("should reject without token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/me" });
      expect(res.statusCode).toBe(401);
    });

    it("should reject with invalid token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: "Bearer bad" } });
      expect(res.statusCode).toBe(401);
    });
  });
});

describe("Server API Integration", () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeEach(async () => {
    resetTables();
    app = await buildApp();
    await app.ready();
    const setupRes = await app.inject({ method: "POST", url: "/api/auth/setup", payload: { username: "admin", password: "password123" } });
    token = JSON.parse(setupRes.payload).token;
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeaders = () => ({ authorization: `Bearer ${token}` });

  describe("POST /api/servers", () => {
    it("should create a server", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/servers", headers: authHeaders(),
        payload: { name: "Test Server", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048, eula_accepted: true },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.server.name).toBe("Test Server");
      expect(body.server.port).toBe(25565);
    });
  });

  describe("GET /api/servers", () => {
    it("should return empty list initially", async () => {
      const res = await app.inject({ method: "GET", url: "/api/servers", headers: authHeaders() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).servers).toEqual([]);
    });

    it("should return created servers", async () => {
      await app.inject({ method: "POST", url: "/api/servers", headers: authHeaders(), payload: { name: "S1", mc_version: "1.21.4", software: "vanilla", ram_mb: 2048, eula_accepted: true } });
      const res = await app.inject({ method: "GET", url: "/api/servers", headers: authHeaders() });
      expect(JSON.parse(res.payload).servers.length).toBe(1);
    });
  });

  describe("GET /api/servers/:id", () => {
    it("should return server by id", async () => {
      const createRes = await app.inject({ method: "POST", url: "/api/servers", headers: authHeaders(), payload: { name: "Test", mc_version: "1.21.4", eula_accepted: true } });
      const id = JSON.parse(createRes.payload).server.id;
      const res = await app.inject({ method: "GET", url: `/api/servers/${id}`, headers: authHeaders() });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).server.name).toBe("Test");
    });

    it("should return 404 for non-existent server", async () => {
      const res = await app.inject({ method: "GET", url: "/api/servers/9999", headers: authHeaders() });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/servers/:id", () => {
    it("should delete a server", async () => {
      const createRes = await app.inject({ method: "POST", url: "/api/servers", headers: authHeaders(), payload: { name: "ToDelete", mc_version: "1.21.4", eula_accepted: true } });
      const id = JSON.parse(createRes.payload).server.id;
      const res = await app.inject({ method: "DELETE", url: `/api/servers/${id}`, headers: authHeaders() });
      expect(res.statusCode).toBe(200);
      const getRes = await app.inject({ method: "GET", url: `/api/servers/${id}`, headers: authHeaders() });
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe("Auth on protected routes", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await app.inject({ method: "GET", url: "/api/servers" });
      expect(res.statusCode).toBe(401);
    });
  });
});
