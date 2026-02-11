/**
 * In-memory rate limiter middleware
 *
 * Limits requests per IP address per sliding window.
 * Uses in-memory Map for simplicity (resets on restart).
 *
 * Default: 60 requests per minute per IP.
 */

import type { Context, Next } from 'hono';

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();
const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 300_000);

export function rateLimiter(limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip')
      || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';

    const key = `${ip}:${new URL(c.req.url).pathname}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', String(limit - 1));
      c.header('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      await next();
      return;
    }

    entry.count++;

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({
        error: 'Too many requests',
        retry_after: retryAfter,
      }, 429);
    }

    await next();
  };
}
