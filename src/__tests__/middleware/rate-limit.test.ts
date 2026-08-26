import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const testDb = vi.hoisted(() => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
});

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));

const { applyTestSchema } = await import("../schema.js");
applyTestSchema(testDb);

const { loadRateLimits, rateLimit } = await import("../../middleware/rate-limit.js");

function seedRule(route: string, method: string, maxRequests: number, windowMs: number, enabled = 1) {
  testDb.prepare(
    "INSERT INTO rate_limits (route, method, max_requests, window_ms, enabled) VALUES (?, ?, ?, ?, ?)"
  ).run(route, method, maxRequests, windowMs, enabled);
}

function makeReply() {
  return {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return {
        send: (payload: unknown) => {
          this.body = payload;
          return this;
        },
      };
    },
  };
}

async function call(mw: ReturnType<typeof rateLimit>, ip: string, url: string, method = "GET") {
  const reply = makeReply();
  const result = await mw({ ip, url, method }, reply);
  return result ? reply : null;
}

beforeEach(() => {
  testDb.exec("DELETE FROM rate_limits");
  testDb.exec("DELETE FROM rate_limit_counts");
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit middleware", () => {
  it("allows requests while under the configured limit", async () => {
    const mw = rateLimit(3, 60000);
    for (let i = 0; i < 3; i++) {
      expect(await call(mw, "1.1.1.1", "/api/open")).toBeNull();
    }
  });

  it("blocks with 429 and a JSON error once the limit is exceeded", async () => {
    const mw = rateLimit(2, 60000);
    await call(mw, "2.2.2.2", "/api/tight");
    await call(mw, "2.2.2.2", "/api/tight");
    const blocked = await call(mw, "2.2.2.2", "/api/tight");
    expect(blocked).not.toBeNull();
    expect(blocked!.statusCode).toBe(429);
    expect(blocked!.body).toEqual({ error: "Too many requests" });
  });

  it("tracks each ip/url/method combination independently", async () => {
    const mw = rateLimit(1, 60000);
    expect(await call(mw, "3.3.3.3", "/api/multi")).toBeNull();
    expect(await call(mw, "3.3.3.4", "/api/multi")).toBeNull();
    expect(await call(mw, "3.3.3.3", "/api/multi-other")).toBeNull();
    const sameAgain = await call(mw, "3.3.3.3", "/api/multi", "POST");
    expect(sameAgain).toBeNull();
    expect(await call(mw, "3.3.3.3", "/api/multi")).not.toBeNull();
  });

  it("resets the counter once the window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const mw = rateLimit(1, 5000);
    expect(await call(mw, "4.4.4.4", "/api/windowed")).toBeNull();
    expect(await call(mw, "4.4.4.4", "/api/windowed")).not.toBeNull();
    vi.advanceTimersByTime(6000);
    expect(await call(mw, "4.4.4.4", "/api/windowed")).toBeNull();
  });
});

describe("db-backed rules", () => {
  it("loads only enabled rules", () => {
    seedRule("/api/enabled-rule", "GET", 1, 60000, 1);
    seedRule("/api/disabled-rule", "GET", 1, 60000, 0);
    loadRateLimits();
    const mw = rateLimit(1000, 60000);
    // Enabled rule caps at 1 even though default is 1000.
    void call(mw, "5.5.5.5", "/api/enabled-rule");
    expect(call(mw, "5.5.5.5", "/api/enabled-rule")).resolves.not.toBeNull();
    // Disabled rule leaves the generous default in place.
    for (let i = 0; i < 5; i++) {
      void call(mw, "6.6.6.6", "/api/disabled-rule");
    }
    expect(call(mw, "6.6.6.6", "/api/disabled-rule")).resolves.toBeNull();
  });

  it("a matching db rule overrides the default max_requests", async () => {
    seedRule("/api/exact", "POST", 2, 60000);
    loadRateLimits();
    const mw = rateLimit(1000, 60000);
    expect(await call(mw, "7.7.7.7", "/api/exact", "POST")).toBeNull();
    expect(await call(mw, "7.7.7.7", "/api/exact", "POST")).toBeNull();
    expect((await call(mw, "7.7.7.7", "/api/exact", "POST"))!.statusCode).toBe(429);
  });

  it("a matching db rule also overrides the default window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    seedRule("/api/slow-window", "GET", 1, 30000);
    loadRateLimits();
    const mw = rateLimit(1000, 1000);
    expect(await call(mw, "8.8.8.8", "/api/slow-window")).toBeNull();
    vi.advanceTimersByTime(2000); // past the tiny default window, inside the rule's 30s
    expect((await call(mw, "8.8.8.8", "/api/slow-window"))!.statusCode).toBe(429);
    vi.advanceTimersByTime(29000); // now past the rule's window
    expect(await call(mw, "8.8.8.8", "/api/slow-window")).toBeNull();
  });

  it("wildcard rules cap every subpath of their prefix", async () => {
    seedRule("/api/wild/*", "GET", 1, 60000);
    loadRateLimits();
    const mw = rateLimit(1000, 60000);
    // Each matching subpath gets the rule's tight budget instead of the default.
    expect(await call(mw, "9.9.9.9", "/api/wild/one")).toBeNull();
    expect((await call(mw, "9.9.9.9", "/api/wild/one"))!.statusCode).toBe(429);
    // A different subpath starts its own bucket, still under the wildcard cap.
    expect(await call(mw, "9.9.9.9", "/api/wild/two/deep")).toBeNull();
    // Unrelated prefixes keep the generous default.
    expect(await call(mw, "9.9.9.9", "/api/other-wild/one")).toBeNull();
    expect(await call(mw, "9.9.9.9", "/api/other-wild/one")).toBeNull();
  });

  it("rules only apply to their own HTTP method", async () => {
    seedRule("/api/method-bound", "DELETE", 1, 60000);
    loadRateLimits();
    const mw = rateLimit(1000, 60000);
    expect(await call(mw, "10.10.10.10", "/api/method-bound", "DELETE")).toBeNull();
    expect((await call(mw, "10.10.10.10", "/api/method-bound", "DELETE"))!.statusCode).toBe(429);
    // Same path via GET keeps the default allowance.
    expect(await call(mw, "10.10.10.10", "/api/method-bound", "GET")).toBeNull();
    expect(await call(mw, "10.10.10.10", "/api/method-bound", "GET")).toBeNull();
  });

  it("loadRateLimits survives a missing table", async () => {
    testDb.exec("DROP TABLE rate_limits");
    expect(() => loadRateLimits()).not.toThrow();
    applyTestSchema(testDb);
    loadRateLimits();
  });
});
