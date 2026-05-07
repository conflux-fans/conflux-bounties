import { fetchBlock } from '../chain/block-fetcher.js';
import { getBlockHash, deleteBlocksAbove, updateSyncState } from '../db/queries.js';
import { MAX_REORG_DEPTH } from '@conflux-analytics/shared';

/**
 * Detect and handle chain reorganizations.
 *
 * Before inserting a new block, verify that the parent hash matches
 * the stored hash of the previous block. On mismatch, walk back up to
 * MAX_REORG_DEPTH blocks to find the fork point, then delete everything
 * above it (cascades to txs and transfers).
 *
 * @returns The block number to resume ingestion from, or null if no reorg.
 */
export async function handleReorg(
  newBlockNumber: number,
  newBlockParentHash: string,
): Promise<number | null> {
  const storedHash = await getBlockHash(newBlockNumber - 1);

  /** No stored block yet — nothing to compare */
  if (!storedHash) return null;

  /** Parent hashes match — no reorg */
  if (storedHash === newBlockParentHash) return null;

  console.warn(`[reorg] Detected at block ${newBlockNumber}: parent hash mismatch`);

  /** Walk back to find the fork point */
  let forkPoint = newBlockNumber - 1;
  const maxDepth = Number(process.env.MAX_REORG_DEPTH ?? MAX_REORG_DEPTH);

  for (let depth = 1; depth <= maxDepth; depth++) {
    const checkBlock = forkPoint - 1;
    if (checkBlock < 0) break;

    const chainBlock = await fetchBlock(BigInt(checkBlock));
    const dbHash = await getBlockHash(checkBlock);

    if (dbHash === chainBlock.block.hash) {
      console.warn(`[reorg] Fork point found at block ${checkBlock} (depth=${depth})`);
      break;
    }

    forkPoint = checkBlock;

    if (depth === maxDepth) {
      console.error(`[reorg] ALERT: Reorg deeper than ${maxDepth} blocks!`);
    }
  }

  /** Delete all blocks above the fork point (cascades to txs/transfers) */
  const deleted = await deleteBlocksAbove(forkPoint);
  console.warn(`[reorg] Rolled back ${deleted} blocks above ${forkPoint}`);

  /** Reset the sync checkpoint to the fork point */
  const forkHash = (await getBlockHash(forkPoint)) ?? '';
  await updateSyncState(forkPoint, forkHash);

  return forkPoint + 1;
}
