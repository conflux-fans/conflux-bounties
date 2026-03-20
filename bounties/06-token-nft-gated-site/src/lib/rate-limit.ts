import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

let loginLimiter: RateLimiterRedis | RateLimiterMemory | null = null;

function getLoginLimiter(): RateLimiterRedis | RateLimiterMemory {
  if (loginLimiter) return loginLimiter;

  const points = Number(process.env.RATE_LIMIT_LOGIN_MAX ?? 10);
  const duration = Number(process.env.RATE_LIMIT_LOGIN_WINDOW_SEC ?? 60);
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const redis = new Redis(redisUrl);
    loginLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl_login",
      points,
      duration,
    });
  } else {
    loginLimiter = new RateLimiterMemory({
      points,
      duration,
    });
  }
  return loginLimiter;
}

export async function consumeLoginLimit(key: string): Promise<void> {
  const limiter = getLoginLimiter();
  try {
    await limiter.consume(key, 1);
  } catch {
    throw new Error("rate_limited");
  }
}
