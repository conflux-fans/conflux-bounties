import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from '@conflux-analytics/shared';
import { createBlockProcessorWorker } from './workers/block-processor.js';
import { createAggregatorWorker } from './workers/aggregator.js';
import { enqueueBackfill } from './pipeline/backfill.js';
import { startLiveTail } from './pipeline/live-tail.js';
import { closePool } from './db/connection.js';

/**
 * Ingestor entry point.
 *
 * 1. Creates the block-processor queue and worker
 * 2. Creates the aggregator repeatable worker
 * 3. Runs initial backfill
 * 4. Starts the live-tail poller
 */
async function main(): Promise<void> {
  const connection = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });

  const blockQueue = new Queue(QUEUE_NAMES.BLOCK_PROCESSOR, { connection });

  /** Start the block-processor worker */
  const blockWorker = createBlockProcessorWorker();
  console.log('[ingestor] Block processor worker started');

  /** Start the aggregator repeatable worker */
  const { worker: aggWorker } = createAggregatorWorker();
  console.log('[ingestor] Aggregator worker started');

  /** Run backfill to catch up to chain head */
  const chunks = await enqueueBackfill(blockQueue);
  console.log(`[ingestor] Backfill enqueued ${chunks} chunks`);

  /** Start live-tail polling */
  startLiveTail(blockQueue).catch((err) => {
    console.error('[ingestor] Live-tail fatal error:', err);
    process.exit(1);
  });

  /** Graceful shutdown */
  const shutdown = async () => {
    console.log('[ingestor] Shutting down...');
    await blockWorker.close();
    await aggWorker.close();
    await blockQueue.close();
    await connection.quit();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[ingestor] Fatal:', err);
  process.exit(1);
});
