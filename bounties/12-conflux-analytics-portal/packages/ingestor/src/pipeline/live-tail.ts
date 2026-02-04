import { Queue } from 'bullmq';
import { getSyncState } from '../db/queries.js';
import { getLatestBlockNumber } from '../chain/block-fetcher.js';
import { sleep, DEFAULT_POLL_INTERVAL_MS } from '@conflux-analytics/shared';

/**
 * Poll the chain for new blocks and enqueue them with high priority.
 * Runs indefinitely until the process is killed.
 */
export async function startLiveTail(queue: Queue): Promise<void> {
  const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);

  console.log(`[live-tail] Starting with ${intervalMs}ms poll interval`);

  while (true) {
    try {
      const { lastBlock } = await getSyncState();
      const latest = await getLatestBlockNumber();

      if (latest > lastBlock) {
        for (let n = lastBlock + 1; n <= latest; n++) {
          await queue.add(
            'live-block',
            { startBlock: n, endBlock: n },
            { priority: 1 },
          );
        }
        console.log(`[live-tail] Enqueued blocks ${lastBlock + 1}..${latest}`);
      }
    } catch (err) {
      console.error('[live-tail] Poll error:', err);
    }

    await sleep(intervalMs);
  }
}
