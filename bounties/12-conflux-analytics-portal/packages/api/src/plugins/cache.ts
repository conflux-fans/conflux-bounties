import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import IORedis from 'ioredis';
import { CACHE_TTL, REDIS_KEYS } from '@conflux-analytics/shared';

let redis: IORedis | null = null;

/** Get or create the Redis client. */
function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  }
  return redis;
}

/**
 * Register a Redis-backed response cache.
 *
 * Caches GET responses for CACHE_TTL.MEDIUM seconds. Subscribes to the
 * aggregator's invalidation channel to flush stale entries automatically.
 */
export async function registerCache(app: FastifyInstance): Promise<void> {
  const r = getRedis();

  /** Subscribe to invalidation events from the aggregator worker */
  const sub = r.duplicate();
  await sub.subscribe(REDIS_KEYS.INVALIDATION_CHANNEL);
  sub.on('message', async () => {
    const keys = await r.keys(`${REDIS_KEYS.CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await r.del(...keys);
    }
  });

  /** Decorate request with cache helpers */
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== 'GET') return;

    const key = `${REDIS_KEYS.CACHE_PREFIX}${req.url}`;
    const cached = await r.get(key);

    if (cached) {
      reply.header('x-cache', 'HIT');
      reply.type('application/json').send(cached);
    }
  });

  app.addHook('onSend', async (req: FastifyRequest, _reply: FastifyReply, payload: string) => {
    if (req.method !== 'GET') return payload;

    const key = `${REDIS_KEYS.CACHE_PREFIX}${req.url}`;
    await r.set(key, payload, 'EX', CACHE_TTL.MEDIUM);
    return payload;
  });
}
