import { createMiddleware } from "hono/factory";
import { RATE_LIMITS } from "@x402/shared";
import { sql } from "../db/index.js";

const requests = new Map<string, { count: number; resetAt: number }>();

// Prune stale entries every 60s to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) requests.delete(key);
  }
}, 60_000).unref();

// Cache API key lookups for 60s to avoid hitting DB on every request
const apiKeyCache = new Map<string, { rateLimit: number; enabled: boolean; expiresAt: number }>();

async function getApiKeyLimit(key: string): Promise<{ rateLimit: number; enabled: boolean } | null> {
  const cached = apiKeyCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  try {
    const [row] = await sql`SELECT rate_limit, enabled FROM api_keys WHERE key = ${key}`;
    if (!row) return null;
    const result = { rateLimit: row.rate_limit, enabled: row.enabled };
    apiKeyCache.set(key, { ...result, expiresAt: Date.now() + 60_000 });
    return result;
  } catch {
    return null;
  }
}

export const rateLimiter = createMiddleware(async (c, next) => {
  const apiKey = c.req.header("x-api-key");
  const ip = c.req.header("x-forwarded-for") || "unknown";
  const now = Date.now();
  const windowMs = 60_000;

  let limit: number = RATE_LIMITS.FREE_RPM;
  let rateLimitKey = `ip:${ip}`;

  // If an API key is provided, use its rate limit
  if (apiKey) {
    const keyInfo = await getApiKeyLimit(apiKey);
    if (keyInfo && !keyInfo.enabled) {
      return c.json({ error: "API key disabled" }, 403);
    }
    if (keyInfo) {
      limit = keyInfo.rateLimit;
      rateLimitKey = `key:${apiKey}`;
    }
  }

  let entry = requests.get(rateLimitKey);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    requests.set(rateLimitKey, entry);
  }

  entry.count++;
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));

  if (entry.count > limit) {
    return c.json({ error: "Too Many Requests" }, 429);
  }

  await next();
});
