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

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let dbRules: RateLimitRule[] = [];

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
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}, 60_000);

if (cleanup.unref) cleanup.unref();

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (request: any, reply: any) => {
    const rule = matchRoute(request.url, request.method);
    const limit = rule ? rule.max_requests : maxRequests;
    const window = rule ? rule.window_ms : windowMs;

    const key = `${request.ip}-${request.url}-${request.method}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (entry && entry.resetAt > now) {
      if (entry.count >= limit) {
        return reply.status(429).send({ error: "Too many requests" });
      }
      entry.count++;
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + window });
    }
  };
}
