import { pool } from './connection.js';

interface DateRange {
  from?: string;
  to?: string;
}

interface Pagination {
  limit: number;
  offset: number;
}

/**
 * Build a WHERE clause fragment for date filtering on a DATE column.
 * Returns [sql, params, nextParamIndex].
 */
function dateFilter(
  column: string,
  range: DateRange,
  startIdx: number,
): { sql: string; params: unknown[]; nextIdx: number } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let idx = startIdx;

  if (range.from) {
    parts.push(`${column} >= $${idx}`);
    params.push(range.from);
    idx++;
  }
  if (range.to) {
    parts.push(`${column} <= $${idx}`);
    params.push(range.to);
    idx++;
  }

  return {
    sql: parts.length > 0 ? parts.join(' AND ') : '1=1',
    params,
    nextIdx: idx,
  };
}

/** GET /health — sync state */
export async function getHealth() {
  const result = await pool.query(
    `SELECT last_block, last_block_hash, updated_at FROM sync_state WHERE id = 1`,
  );
  return result.rows[0] ?? { last_block: 0, last_block_hash: '', updated_at: null };
}

/** GET /activity/daily */
export async function getDailyActivity(range: DateRange, pagination: Pagination) {
  const df = dateFilter('date', range, 1);
  const result = await pool.query(
    `SELECT date, tx_count, active_accounts, new_contracts, total_gas_used
     FROM daily_activity
     WHERE ${df.sql}
     ORDER BY date DESC
     LIMIT $${df.nextIdx} OFFSET $${df.nextIdx + 1}`,
    [...df.params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /fees/daily */
export async function getDailyFees(range: DateRange, pagination: Pagination) {
  const df = dateFilter('date', range, 1);
  const result = await pool.query(
    `SELECT date, avg_gas_price, total_burned, total_tips, tx_count
     FROM daily_fees
     WHERE ${df.sql}
     ORDER BY date DESC
     LIMIT $${df.nextIdx} OFFSET $${df.nextIdx + 1}`,
    [...df.params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /contracts/top */
export async function getTopContracts(
  range: DateRange,
  pagination: Pagination,
  sort: string,
  order: string,
) {
  const df = dateFilter('date', range, 1);
  const sortCol = ['tx_count', 'gas_used', 'unique_callers'].includes(sort) ? sort : 'tx_count';
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';

  const result = await pool.query(
    `SELECT contract_address,
            SUM(tx_count)::INTEGER AS tx_count,
            SUM(unique_callers)::INTEGER AS unique_callers,
            SUM(gas_used) AS gas_used,
            d.dapp_name, d.category
     FROM contract_daily_stats c
     LEFT JOIN dapp_tags d ON d.contract_address = c.contract_address
     WHERE ${df.sql}
     GROUP BY c.contract_address, d.dapp_name, d.category
     ORDER BY ${sortCol} ${orderDir}
     LIMIT $${df.nextIdx} OFFSET $${df.nextIdx + 1}`,
    [...df.params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /contracts/:addr/stats */
export async function getContractStats(addr: string, range: DateRange, pagination: Pagination) {
  const df = dateFilter('date', range, 2);
  const result = await pool.query(
    `SELECT date, tx_count, unique_callers, gas_used
     FROM contract_daily_stats
     WHERE contract_address = $1 AND ${df.sql}
     ORDER BY date DESC
     LIMIT $${df.nextIdx} OFFSET $${df.nextIdx + 1}`,
    [addr, ...df.params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /tokens */
export async function getTokens(range: DateRange, pagination: Pagination) {
  const df = dateFilter('s.date', range, 1);
  const result = await pool.query(
    `SELECT t.address, t.name, t.symbol, t.decimals,
            COALESCE(SUM(s.transfer_count), 0)::INTEGER AS transfer_count,
            (SELECT COUNT(*) FROM token_holders h WHERE h.token_address = t.address)::INTEGER AS holder_count
     FROM tokens t
     LEFT JOIN token_daily_stats s ON s.token_address = t.address AND ${df.sql}
     GROUP BY t.address, t.name, t.symbol, t.decimals
     ORDER BY transfer_count DESC
     LIMIT $${df.nextIdx} OFFSET $${df.nextIdx + 1}`,
    [...df.params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /tokens/:addr/holders */
export async function getTokenHolders(addr: string, pagination: Pagination) {
  const result = await pool.query(
    `SELECT holder_address, balance, last_updated
     FROM token_holders
     WHERE token_address = $1
     ORDER BY balance::NUMERIC DESC
     LIMIT $2 OFFSET $3`,
    [addr, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /tokens/:addr/stats */
export async function getTokenStats(addr: string, range: DateRange, pagination: Pagination) {
  const df = dateFilter('date', range, 2);
  const result = await pool.query(
    `SELECT date, transfer_count, unique_senders, unique_receivers, volume
     FROM token_daily_stats
     WHERE token_address = $1 AND ${df.sql}
     ORDER BY date DESC
     LIMIT $${df.nextIdx} OFFSET $${df.nextIdx + 1}`,
    [addr, ...df.params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /dapps/leaderboard */
export async function getDappLeaderboard(
  range: DateRange,
  pagination: Pagination,
  category?: string,
) {
  const df = dateFilter('c.date', range, 1);
  let extraWhere = '';
  const params = [...df.params];
  let nextIdx = df.nextIdx;

  if (category) {
    extraWhere = ` AND d.category = $${nextIdx}`;
    params.push(category);
    nextIdx++;
  }

  const result = await pool.query(
    `SELECT d.dapp_name, d.category, d.logo_url,
            SUM(c.tx_count)::INTEGER AS tx_count,
            SUM(c.gas_used) AS gas_used,
            SUM(c.unique_callers)::INTEGER AS unique_callers
     FROM dapp_tags d
     JOIN contract_daily_stats c ON c.contract_address = d.contract_address
     WHERE ${df.sql}${extraWhere}
     GROUP BY d.dapp_name, d.category, d.logo_url
     ORDER BY tx_count DESC
     LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
    [...params, pagination.limit, pagination.offset],
  );
  return result.rows;
}

/** GET /network/overview */
export async function getNetworkOverview() {
  const result = await pool.query(`
    SELECT
      (SELECT MAX(number) FROM blocks) AS latest_block,
      (SELECT COUNT(*) FROM transactions) AS total_transactions,
      (SELECT COUNT(*)::FLOAT /
        GREATEST(MAX(timestamp) - MIN(timestamp), 1)
       FROM blocks) AS tps,
      (SELECT AVG(b2.timestamp - b1.timestamp)
       FROM blocks b1
       JOIN blocks b2 ON b2.number = b1.number + 1
       WHERE b1.number >= (SELECT MAX(number) - 100 FROM blocks)) AS avg_block_time
  `);
  return result.rows[0];
}

/** GET /transactions/stats */
export async function getTransactionStats(range: DateRange) {
  const df = dateFilter('DATE(TO_TIMESTAMP(timestamp))', range, 1);
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'success')::INTEGER AS total_success,
       COUNT(*) FILTER (WHERE status = 'failure')::INTEGER AS total_failure,
       ROUND(COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / GREATEST(COUNT(*), 1), 4)::FLOAT AS success_rate
     FROM transactions
     WHERE ${df.sql}`,
    df.params,
  );
  return result.rows[0];
}

/** POST /shares — create a shared view */
export async function createSharedView(slug: string, config: object, expiresInDays?: number) {
  const expiresAt = expiresInDays
    ? `NOW() + INTERVAL '${expiresInDays} days'`
    : 'NULL';

  await pool.query(
    `INSERT INTO shared_views (slug, config, expires_at)
     VALUES ($1, $2, ${expiresAt})`,
    [slug, JSON.stringify(config)],
  );
}

/** GET /shares/:slug */
export async function getSharedView(slug: string) {
  const result = await pool.query(
    `SELECT slug, config, created_at, expires_at
     FROM shared_views
     WHERE slug = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
    [slug],
  );
  return result.rows[0] ?? null;
}

/** POST /webhooks */
export async function createWebhook(url: string, eventType: string) {
  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (url, event_type)
     VALUES ($1, $2) RETURNING id, url, event_type, active, created_at`,
    [url, eventType],
  );
  return result.rows[0];
}

/** Validate an API key and return its record */
export async function getApiKeyByKey(key: string) {
  const result = await pool.query(
    `SELECT id, key, name, rate_limit, created_at FROM api_keys WHERE key = $1`,
    [key],
  );
  return result.rows[0] ?? null;
}
