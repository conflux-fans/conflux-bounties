import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { runAllAggregations } from '../db/aggregation.js';
import { QUEUE_NAMES, DEFAULT_AGGREGATOR_INTERVAL_MS, REDIS_KEYS } from '@conflux-analytics/shared';

/**
 * Create a repeatable BullMQ job that re-runs all aggregation queries
 * and publishes a Redis cache invalidation event.
 */
export function createAggregatorWorker(): { worker: Worker; queue: Queue } {
  const connection = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAMES.AGGREGATOR, { connection });
  const intervalMs = Number(process.env.AGGREGATOR_INTERVAL_MS ?? DEFAULT_AGGREGATOR_INTERVAL_MS);

  /** Schedule the repeatable aggregation job */
  queue.upsertJobScheduler(
    'aggregate-all',
    { every: intervalMs },
    { name: 'aggregate-all' },
  );

  const worker = new Worker(
    QUEUE_NAMES.AGGREGATOR,
    async () => {
      console.log('[aggregator] Running aggregations...');
      const start = Date.now();
      await runAllAggregations();
      console.log(`[aggregator] Done in ${Date.now() - start}ms`);

      /** Publish cache invalidation so the API layer clears stale data */
      await connection.publish(REDIS_KEYS.INVALIDATION_CHANNEL, 'aggregation-complete');
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (_job, err) => {
    console.error('[aggregator] Job failed:', err.message);
  });

  return { worker, queue };
}
