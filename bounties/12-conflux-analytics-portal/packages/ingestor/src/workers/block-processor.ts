import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { fetchBlock } from '../chain/block-fetcher.js';
import {
  insertBlock,
  insertTransactions,
  insertTokenTransfers,
  updateSyncState,
} from '../db/queries.js';
import { handleReorg } from '../pipeline/reorg.js';
import { QUEUE_NAMES, DEFAULT_CONCURRENCY } from '@conflux-analytics/shared';

interface BlockJobData {
  startBlock: number;
  endBlock: number;
}

/**
 * Create and return the block-processor BullMQ worker.
 *
 * Each job covers a range [startBlock, endBlock]. For every block in the range
 * the worker fetches the block + receipts, checks for reorgs, inserts into the
 * DB, and advances the sync checkpoint.
 */
export function createBlockProcessorWorker(): Worker<BlockJobData> {
  const connection = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });

  const concurrency = Number(process.env.INGESTOR_CONCURRENCY ?? DEFAULT_CONCURRENCY);

  const worker = new Worker<BlockJobData>(
    QUEUE_NAMES.BLOCK_PROCESSOR,
    async (job: Job<BlockJobData>) => {
      const { startBlock, endBlock } = job.data;

      for (let n = startBlock; n <= endBlock; n++) {
        const { block, transactions, transfers } = await fetchBlock(BigInt(n));

        /** Check for reorg before inserting */
        const resumeFrom = await handleReorg(block.number, block.parentHash);
        if (resumeFrom !== null) {
          console.warn(`[block-processor] Reorg detected — will re-process from ${resumeFrom}`);
          return;
        }

        await insertBlock(block);
        await insertTransactions(transactions);
        await insertTokenTransfers(transfers);
        await updateSyncState(block.number, block.hash);

        await job.updateProgress(
          Math.round(((n - startBlock + 1) / (endBlock - startBlock + 1)) * 100),
        );
      }
    },
    { connection, concurrency },
  );

  worker.on('completed', (job) => {
    console.log(`[block-processor] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[block-processor] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
