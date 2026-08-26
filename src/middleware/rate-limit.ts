import db from "../config/database.js";

interface RateLimitRule {
  id: number;
  route: string;
  method: string;
  max_requests: number;
  window_ms: number;
  enabled: number;
  description: string | null;
  created_at: string;
}

let dbRules: RateLimitRule[] = [];

let _getCount: any = null;
let _upsertCount: any = null;
let _deleteExpired: any = null;

function getStatements() {
  if (!_getCount) {
    _getCount = db.prepare("SELECT count, reset_at FROM rate_limit_counts WHERE key = ?");
    _upsertCount = db.prepare("INSERT OR REPLACE INTO rate_limit_counts (key, count, reset_at) VALUES (?, ?, ?)");
    _deleteExpired = db.prepare("DELETE FROM rate_limit_counts WHERE reset_at <= ?");
  }
  return { getCount: _getCount, upsertCount: _upsertCount, deleteExpired: _deleteExpired };
}

export function loadRateLimits() {
  try {
    dbRules = db.prepare("SELECT * FROM rate_limits WHERE enabled = 1").all() as RateLimitRule[];
  } catch {
    dbRules = [];
  }
}

function matchRoute(url: string, method: string): RateLimitRule | undefined {
  for (const rule of dbRules) {
    if (rule.method !== method) continue;
    if (rule.route.endsWith("*")) {
      const prefix = rule.route.slice(0, -1);
      if (url.startsWith(prefix)) return rule;
    } else if (rule.route === url) {
      return rule;
    }
  }
  return undefined;
}

const cleanup = setInterval(() => {
  try {
    const { deleteExpired } = getStatements();
    deleteExpired.run(Date.now());
  } catch {}
}, 60_000);

if (cleanup.unref) cleanup.unref();

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (request: any, reply: any) => {
    const rule = matchRoute(request.url, request.method);
    const limit = rule ? rule.max_requests : maxRequests;
    const window = rule ? rule.window_ms : windowMs;

    const key = `${request.ip}-${request.url}-${request.method}`;
    const now = Date.now();
    const { getCount, upsertCount } = getStatements();
    const row = getCount.get(key) as { count: number; reset_at: number } | undefined;

    if (row && row.reset_at > now) {
      if (row.count >= limit) {
        return reply.status(429).send({ error: "Too many requests" });
      }
      upsertCount.run(key, row.count + 1, row.reset_at);
    } else {
      upsertCount.run(key, 1, now + window);
    }
  };
}
