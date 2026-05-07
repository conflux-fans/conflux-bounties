import { pool } from './connection.js';
import type { Block, Transaction, TokenTransfer } from '@conflux-analytics/shared';

/**
 * Insert a block row. Uses ON CONFLICT to handle re-processing.
 */
export async function insertBlock(block: Block): Promise<void> {
  await pool.query(
    `INSERT INTO blocks (number, hash, parent_hash, timestamp, gas_used, gas_limit, base_fee_per_gas, tx_count, miner)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (number) DO UPDATE SET
       hash = EXCLUDED.hash,
       parent_hash = EXCLUDED.parent_hash,
       timestamp = EXCLUDED.timestamp,
       gas_used = EXCLUDED.gas_used,
       gas_limit = EXCLUDED.gas_limit,
       base_fee_per_gas = EXCLUDED.base_fee_per_gas,
       tx_count = EXCLUDED.tx_count,
       miner = EXCLUDED.miner`,
    [
      block.number,
      block.hash,
      block.parentHash,
      block.timestamp,
      block.gasUsed,
      block.gasLimit,
      block.baseFeePerGas,
      block.txCount,
      block.miner,
    ],
  );
}

/**
 * Batch-insert transactions. Uses ON CONFLICT DO NOTHING to skip duplicates.
 */
export async function insertTransactions(txs: Transaction[]): Promise<void> {
  if (txs.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < txs.length; i++) {
    const offset = i * 12;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12})`,
    );
    const tx = txs[i];
    values.push(
      tx.hash,
      tx.blockNumber,
      tx.from,
      tx.to,
      tx.value,
      tx.gasUsed,
      tx.gasPrice,
      tx.maxFeePerGas,
      tx.maxPriorityFeePerGas,
      tx.status,
      tx.timestamp,
      tx.input,
    );
  }

  await pool.query(
    `INSERT INTO transactions (hash, block_number, "from", "to", value, gas_used, gas_price, max_fee_per_gas, max_priority_fee_per_gas, status, timestamp, input)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (hash) DO NOTHING`,
    values,
  );
}

/**
 * Batch-insert ERC-20 token transfers.
 */
export async function insertTokenTransfers(transfers: TokenTransfer[]): Promise<void> {
  if (transfers.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < transfers.length; i++) {
    const offset = i * 8;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8})`,
    );
    const t = transfers[i];
    values.push(
      t.txHash,
      t.logIndex,
      t.tokenAddress,
      t.from,
      t.to,
      t.value,
      t.blockNumber,
      t.timestamp,
    );
  }

  await pool.query(
    `INSERT INTO token_transfers (tx_hash, log_index, token_address, "from", "to", value, block_number, timestamp)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (tx_hash, log_index) DO NOTHING`,
    values,
  );
}

/**
 * Update the sync_state checkpoint after processing a block.
 */
export async function updateSyncState(blockNumber: number, blockHash: string): Promise<void> {
  await pool.query(
    `UPDATE sync_state SET last_block = $1, last_block_hash = $2, updated_at = NOW() WHERE id = 1`,
    [blockNumber, blockHash],
  );
}

/**
 * Read the current sync checkpoint.
 */
export async function getSyncState(): Promise<{ lastBlock: number; lastBlockHash: string }> {
  const result = await pool.query(`SELECT last_block, last_block_hash FROM sync_state WHERE id = 1`);
  if (result.rows.length === 0) {
    return { lastBlock: 0, lastBlockHash: '' };
  }
  return {
    lastBlock: Number(result.rows[0].last_block),
    lastBlockHash: result.rows[0].last_block_hash,
  };
}

/**
 * Get the hash of a stored block by number. Returns null if not found.
 */
export async function getBlockHash(blockNumber: number): Promise<string | null> {
  const result = await pool.query(`SELECT hash FROM blocks WHERE number = $1`, [blockNumber]);
  return result.rows[0]?.hash ?? null;
}

/**
 * Delete all blocks (and cascading txs/transfers) above the given block number.
 * Used during reorg rollback.
 */
export async function deleteBlocksAbove(blockNumber: number): Promise<number> {
  const result = await pool.query(`DELETE FROM blocks WHERE number > $1`, [blockNumber]);
  return result.rowCount ?? 0;
}
