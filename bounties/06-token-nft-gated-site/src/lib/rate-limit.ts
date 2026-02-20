import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function createRatelimit(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: true,
    prefix: 'gated-site',
  });
}

const ratelimit = createRatelimit();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/** Check rate limit by identifier (IP or wallet address) */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    // Rate limiting disabled — allow all
    return { success: true, remaining: 999, reset: 0 };
  }

  const result = await ratelimit.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
