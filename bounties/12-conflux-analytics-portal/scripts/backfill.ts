import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from '@conflux-analytics/shared';

/**
 * CLI script to manually trigger a backfill.
 * Usage: pnpm backfill [startBlock] [endBlock]
 */
async function main() {
  const connection = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAMES.BLOCK_PROCESSOR, { connection });

  const startBlock = Number(process.argv[2] ?? 0);
  const endBlock = Number(process.argv[3] ?? startBlock + 100);

  const chunkSize = 10;
  let jobCount = 0;

  for (let i = startBlock; i <= endBlock; i += chunkSize) {
    const end = Math.min(i + chunkSize - 1, endBlock);
    await queue.add('manual-backfill', { startBlock: i, endBlock: end }, { priority: 10 });
    jobCount++;
  }

  console.log(`[backfill] Enqueued ${jobCount} jobs for blocks ${startBlock}..${endBlock}`);

  await queue.close();
  await connection.quit();
}

main().catch((err) => {
  console.error('[backfill] Error:', err);
  process.exit(1);
});
