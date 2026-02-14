import { pool } from './connection.js';

/**
 * Recompute daily_activity from raw transactions for all dates
 * that have un-aggregated data. Uses INSERT ... ON CONFLICT to upsert.
 */
export async function aggregateDailyActivity(): Promise<void> {
  await pool.query(`
    INSERT INTO daily_activity (date, tx_count, active_accounts, new_contracts, total_gas_used)
    SELECT
      DATE(TO_TIMESTAMP(t.timestamp)) AS date,
      COUNT(*)::INTEGER AS tx_count,
      COUNT(DISTINCT t."from")::INTEGER AS active_accounts,
      COUNT(*) FILTER (WHERE t."to" IS NULL)::INTEGER AS new_contracts,
      SUM(t.gas_used) AS total_gas_used
    FROM transactions t
    GROUP BY DATE(TO_TIMESTAMP(t.timestamp))
    ON CONFLICT (date) DO UPDATE SET
      tx_count = EXCLUDED.tx_count,
      active_accounts = EXCLUDED.active_accounts,
      new_contracts = EXCLUDED.new_contracts,
      total_gas_used = EXCLUDED.total_gas_used
  `);
}

/**
 * Recompute daily_fees from raw transactions.
 */
export async function aggregateDailyFees(): Promise<void> {
  await pool.query(`
    INSERT INTO daily_fees (date, avg_gas_price, total_burned, total_tips, tx_count)
    SELECT
      DATE(TO_TIMESTAMP(t.timestamp)) AS date,
      AVG(t.gas_price) AS avg_gas_price,
      SUM(t.gas_used * COALESCE(b.base_fee_per_gas, 0)) AS total_burned,
      SUM(t.gas_used * GREATEST(t.gas_price - COALESCE(b.base_fee_per_gas, 0), 0)) AS total_tips,
      COUNT(*)::INTEGER AS tx_count
    FROM transactions t
    JOIN blocks b ON b.number = t.block_number
    GROUP BY DATE(TO_TIMESTAMP(t.timestamp))
    ON CONFLICT (date) DO UPDATE SET
      avg_gas_price = EXCLUDED.avg_gas_price,
      total_burned = EXCLUDED.total_burned,
      total_tips = EXCLUDED.total_tips,
      tx_count = EXCLUDED.tx_count
  `);
}

/**
 * Recompute per-contract daily stats from raw transactions.
 */
export async function aggregateContractStats(): Promise<void> {
  await pool.query(`
    INSERT INTO contract_daily_stats (contract_address, date, tx_count, unique_callers, gas_used)
    SELECT
      t."to" AS contract_address,
      DATE(TO_TIMESTAMP(t.timestamp)) AS date,
      COUNT(*)::INTEGER AS tx_count,
      COUNT(DISTINCT t."from")::INTEGER AS unique_callers,
      SUM(t.gas_used) AS gas_used
    FROM transactions t
    WHERE t."to" IS NOT NULL AND LENGTH(t.input) > 2
    GROUP BY t."to", DATE(TO_TIMESTAMP(t.timestamp))
    ON CONFLICT (contract_address, date) DO UPDATE SET
      tx_count = EXCLUDED.tx_count,
      unique_callers = EXCLUDED.unique_callers,
      gas_used = EXCLUDED.gas_used
  `);
}

/**
 * Recompute per-token daily stats from token_transfers.
 */
export async function aggregateTokenStats(): Promise<void> {
  await pool.query(`
    INSERT INTO token_daily_stats (token_address, date, transfer_count, unique_senders, unique_receivers, volume)
    SELECT
      tt.token_address,
      DATE(TO_TIMESTAMP(tt.timestamp)) AS date,
      COUNT(*)::INTEGER AS transfer_count,
      COUNT(DISTINCT tt."from")::INTEGER AS unique_senders,
      COUNT(DISTINCT tt."to")::INTEGER AS unique_receivers,
      SUM(tt.value) AS volume
    FROM token_transfers tt
    GROUP BY tt.token_address, DATE(TO_TIMESTAMP(tt.timestamp))
    ON CONFLICT (token_address, date) DO UPDATE SET
      transfer_count = EXCLUDED.transfer_count,
      unique_senders = EXCLUDED.unique_senders,
      unique_receivers = EXCLUDED.unique_receivers,
      volume = EXCLUDED.volume
  `);
}

/**
 * Recompute materialized token holder balances.
 * Sums all inbound minus outbound transfers per holder per token.
 */
export async function aggregateTokenHolders(): Promise<void> {
  await pool.query(`
    INSERT INTO token_holders (token_address, holder_address, balance, last_updated)
    SELECT
      token_address,
      holder_address,
      SUM(amount) AS balance,
      MAX(ts) AS last_updated
    FROM (
      SELECT token_address, "to" AS holder_address, value AS amount, timestamp AS ts
      FROM token_transfers
      UNION ALL
      SELECT token_address, "from" AS holder_address, -value AS amount, timestamp AS ts
      FROM token_transfers
    ) sub
    GROUP BY token_address, holder_address
    HAVING SUM(amount) > 0
    ON CONFLICT (token_address, holder_address) DO UPDATE SET
      balance = EXCLUDED.balance,
      last_updated = EXCLUDED.last_updated
  `);
}

/**
 * Run all aggregation queries in sequence.
 */
export async function runAllAggregations(): Promise<void> {
  await aggregateDailyActivity();
  await aggregateDailyFees();
  await aggregateContractStats();
  await aggregateTokenStats();
  await aggregateTokenHolders();
}
