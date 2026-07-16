const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (request: any, reply: any) => {
    const key = `${request.ip}-${request.url}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (entry && entry.resetAt > now) {
      if (entry.count >= maxRequests) {
        return reply.status(429).send({ error: "Too many requests" });
      }
      entry.count++;
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    }
  };
}
