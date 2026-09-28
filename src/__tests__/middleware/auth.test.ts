import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";

const testDb = vi.hoisted(() => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
});

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/env.js", () => ({
  env: {
    NODE_ENV: "test", PANEL_HOST: "127.0.0.1", PANEL_PORT: 3000, API_PORT: 3001,
    JWT_SECRET: "middleware-test-secret", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
    DOCKER_IMAGE: "itzg/minecraft-server", SERVER_PORT_RANGE_START: 25565,
    SERVER_PORT_RANGE_END: 25665, NODE_NAME: "master", NODE_API_KEY: "test-key", GRPC_PORT: 50051,
  },
}));

const { applyTestSchema } = await import("../schema.js");
applyTestSchema(testDb);

const { authMiddleware, adminMiddleware, operatorOrAboveMiddleware } = await import("../../middleware/auth.js");
const { createUser } = await import("../../services/auth.service.js");

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(jwt, { secret: "middleware-test-secret", sign: { expiresIn: "1d" } });
  app.get("/guarded", { preHandler: [authMiddleware] }, async (request) => ({ user: request.user }));
  app.get("/admin-only", { preHandler: [authMiddleware, adminMiddleware] }, async () => ({ ok: true }));
  app.get("/operator-or-above", { preHandler: [authMiddleware, operatorOrAboveMiddleware] }, async () => ({ ok: true }));
  return app;
}

describe("authMiddleware", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    testDb.exec("DELETE FROM users");
    testDb.exec("DELETE FROM sessions");
    app = await buildApp();
    await app.ready();
  });

  async function createAdmin() {
    return createUser("admin", "password123", "admin");
  }

  function sign(payload: object) {
    return app.jwt.sign(payload as Record<string, unknown>);
  }

  it("rejects with 401 when no token is provided", async () => {
    const res = await app.inject({ method: "GET", url: "/guarded" });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("No token provided");
  });

  it("rejects with 401 for a garbage token", async () => {
    const res = await app.inject({ method: "GET", url: "/guarded", headers: { authorization: "Bearer not.a.jwt" } });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("Invalid token");
  });

  it("rejects with 401 when the user no longer exists", async () => {
    const token = sign({ id: 9999, username: "ghost", role: "admin" });
    const res = await app.inject({ method: "GET", url: "/guarded", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("User no longer exists");
  });

  it("accepts a valid token without jti and exposes request.user", async () => {
    const admin = await createAdmin();
    const token = sign({ id: admin.id, username: "admin", role: "admin" });
    const res = await app.inject({ method: "GET", url: "/guarded", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).user.username).toBe("admin");
  });

  it("accepts a token whose jti resolves to an active session", async () => {
    const admin = await createAdmin();
    const { createSession } = await import("../../services/auth.service.js");
    const jti = createSession(admin.id);
    const token = sign({ id: admin.id, username: "admin", role: "admin", jti });
    const res = await app.inject({ method: "GET", url: "/guarded", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).user.id).toBe(admin.id);
  });

  it("rejects with 401 when the jti belongs to a revoked session", async () => {
    const admin = await createAdmin();
    const { createSession, revokeSessionByJti } = await import("../../services/auth.service.js");
    const jti = createSession(admin.id);
    revokeSessionByJti(jti);
    const token = sign({ id: admin.id, username: "admin", role: "admin", jti });
    const res = await app.inject({ method: "GET", url: "/guarded", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("Session has been revoked");
  });

  it("updates the session last_used on successful auth", async () => {
    const admin = await createAdmin();
    const { createSession } = await import("../../services/auth.service.js");
    const jti = createSession(admin.id);
    testDb.prepare("UPDATE sessions SET last_used = '2020-01-01 00:00:00' WHERE jti = ?").run(jti);
    const token = sign({ id: admin.id, username: "admin", role: "admin", jti });
    await app.inject({ method: "GET", url: "/guarded", headers: { authorization: `Bearer ${token}` } });
    const row = testDb.prepare("SELECT last_used FROM sessions WHERE jti = ?").get(jti) as { last_used: string };
    expect(row.last_used).not.toBe("2020-01-01 00:00:00");
  });

  it("also accepts the token from the servernest_token cookie", async () => {
    const admin = await createAdmin();
    const token = sign({ id: admin.id, username: "admin", role: "admin" });
    const res = await app.inject({ method: "GET", url: "/guarded", cookies: { servernest_token: token } });
    expect(res.statusCode).toBe(200);
  });
});

describe("adminMiddleware", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    testDb.exec("DELETE FROM users");
    testDb.exec("DELETE FROM sessions");
    app = await buildApp();
    await app.ready();
  });

  it("blocks non-admin users with 403", async () => {
    const user = await createUser("regular", "password123", "user");
    const token = app.jwt.sign({ id: user.id, username: "regular", role: "user" });
    const res = await app.inject({ method: "GET", url: "/admin-only", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toBe("Admin access required");
  });

  it("lets admin users through", async () => {
    const admin = await createUser("admin", "password123", "admin");
    const token = app.jwt.sign({ id: admin.id, username: "admin", role: "admin" });
    const res = await app.inject({ method: "GET", url: "/admin-only", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
  });
});

describe("operatorOrAboveMiddleware", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    testDb.exec("DELETE FROM users");
    testDb.exec("DELETE FROM sessions");
    app = await buildApp();
    await app.ready();
  });

  it("lets admin users through", async () => {
    const admin = await createUser("admin", "password123", "admin");
    const token = app.jwt.sign({ id: admin.id, username: "admin", role: "admin" });
    const res = await app.inject({ method: "GET", url: "/operator-or-above", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
  });

  it("lets operator users through", async () => {
    const operator = await createUser("operator", "password123", "operator");
    const token = app.jwt.sign({ id: operator.id, username: "operator", role: "operator" });
    const res = await app.inject({ method: "GET", url: "/operator-or-above", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
  });

  it("blocks regular users with 403", async () => {
    const user = await createUser("regular", "password123", "user");
    const token = app.jwt.sign({ id: user.id, username: "regular", role: "user" });
    const res = await app.inject({ method: "GET", url: "/operator-or-above", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toBe("Admin or operator access required");
  });

  it("blocks users with unknown role", async () => {
    const user = await createUser("weird", "password123", "user");
    const token = app.jwt.sign({ id: user.id, username: "weird", role: "hacker" });
    const res = await app.inject({ method: "GET", url: "/operator-or-above", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });
});
