import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { RATE_LIMITS } from '@conflux-analytics/shared';

/**
 * Register rate limiting.
 * Authenticated requests (via x-api-key header) get a higher limit.
 */
export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: (req) => {
      const hasKey = !!req.headers['x-api-key'];
      return hasKey
        ? Number(process.env.RATE_LIMIT_AUTHED ?? RATE_LIMITS.AUTHED)
        : Number(process.env.RATE_LIMIT_PUBLIC ?? RATE_LIMITS.PUBLIC);
    },
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return (req.headers['x-api-key'] as string) ?? req.ip;
    },
  });
}
