import { Queue } from 'bullmq';
import { getSyncState } from '../db/queries.js';
import { getLatestBlockNumber } from '../chain/block-fetcher.js';
import { chunkRange, QUEUE_NAMES, BACKFILL_CHUNK_SIZE } from '@conflux-analytics/shared';

/**
 * Enqueue backfill jobs to process all blocks between the last checkpoint
 * and the current chain head.
 *
 * Blocks are partitioned into chunks and enqueued as BullMQ jobs so they
 * can be processed by concurrent block-processor workers.
 */
export async function enqueueBackfill(queue: Queue): Promise<number> {
  const { lastBlock } = await getSyncState();
  const latestOnChain = await getLatestBlockNumber();

  if (lastBlock >= latestOnChain) {
    console.log(`[backfill] Already synced to block ${lastBlock}`);
    return 0;
  }

  const chunkSize = Number(process.env.BACKFILL_CHUNK_SIZE ?? BACKFILL_CHUNK_SIZE);
  const chunks = chunkRange(lastBlock + 1, latestOnChain, chunkSize);

  console.log(
    `[backfill] Enqueueing ${chunks.length} chunks (blocks ${lastBlock + 1}..${latestOnChain})`,
  );

  for (const [start, end] of chunks) {
    await queue.add(
      'backfill-chunk',
      { startBlock: start, endBlock: end },
      { priority: 10 },
    );
  }

  return chunks.length;
}
