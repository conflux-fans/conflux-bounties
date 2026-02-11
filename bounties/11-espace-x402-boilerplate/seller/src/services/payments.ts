/**
 * Payment logging and query service
 *
 * Centralizes all DB interactions for x402 payments:
 *   - logPayment()   — insert settled payment into x402_payments
 *   - getHistory()   — paginated payment history
 *   - getStats()     — aggregated revenue and usage stats
 */

import { db } from '../config/database.js';
import type { SettlementResult } from '../types.js';
import type { TokenConfig, NetworkConfig } from '../config/networks.js';

/**
 * Log a settled payment to the database
 */
export async function logPayment(
  settlement: SettlementResult,
  token: TokenConfig,
  network: NetworkConfig,
  endpoint: string,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO x402_payments (invoice_id, payer_address, token_address, token_symbol, amount, tx_hash, network, payment_method, endpoint, settled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        crypto.randomUUID().replace(/-/g, ''),
        settlement.payer || '',
        token.address,
        token.symbol,
        token.pricePerQuery,
        settlement.transaction || '',
        network.caip2,
        token.paymentMethod,
        endpoint,
      ],
    );
  } catch (err: any) {
    console.error('[payments] DB log error:', err.message);
  }
}

/**
 * Get paginated payment history
 */
export async function getHistory(options: {
  network?: string;
  limit?: number;
  offset?: number;
}): Promise<{ payments: any[]; total: number }> {
  const { network, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: any[] = [];

  if (network) {
    params.push(network);
    conditions.push(`network = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countResult, dataResult] = await Promise.all([
    db.query(`SELECT count(*)::int AS total FROM x402_payments ${where}`, params),
    db.query(
      `SELECT id, invoice_id, payer_address, token_address, token_symbol, amount, tx_hash, network, payment_method, endpoint, settled_at, created_at
       FROM x402_payments ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);

  return {
    total: countResult.rows[0]?.total || 0,
    payments: dataResult.rows.map(formatPaymentRow),
  };
}

/**
 * Get aggregated payment stats
 */
export async function getStats(network?: string): Promise<any> {
  const cond = network ? `WHERE network = $1` : '';
  const params = network ? [network] : [];

  const [
    totalResult,
    byTokenResult,
    byMethodResult,
    byEndpointResult,
    recentResult,
    dailyResult,
  ] = await Promise.all([
    // Total payments and unique payers
    db.query(
      `SELECT count(*)::int AS total_payments,
              count(DISTINCT payer_address) FILTER (WHERE payer_address != '')::int AS unique_payers,
              min(created_at) AS first_payment,
              max(created_at) AS last_payment
       FROM x402_payments ${cond}`,
      params,
    ),
    // Breakdown by token
    db.query(
      `SELECT token_symbol, count(*)::int AS count, payment_method
       FROM x402_payments ${cond}
       GROUP BY token_symbol, payment_method
       ORDER BY count DESC`,
      params,
    ),
    // Breakdown by payment method
    db.query(
      `SELECT payment_method, count(*)::int AS count
       FROM x402_payments ${cond}
       GROUP BY payment_method
       ORDER BY count DESC`,
      params,
    ),
    // Breakdown by endpoint
    db.query(
      `SELECT endpoint, count(*)::int AS count
       FROM x402_payments ${cond}
       GROUP BY endpoint
       ORDER BY count DESC`,
      params,
    ),
    // Recent 5 payments
    db.query(
      `SELECT id, payer_address, token_symbol, amount, tx_hash, network, payment_method, endpoint, created_at
       FROM x402_payments ${cond}
       ORDER BY created_at DESC
       LIMIT 5`,
      params,
    ),
    // Daily payment counts (last 7 days)
    db.query(
      network
        ? `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM x402_payments WHERE network = $1 AND created_at >= NOW() - INTERVAL '7 days'
           GROUP BY day ORDER BY day DESC`
        : `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM x402_payments WHERE created_at >= NOW() - INTERVAL '7 days'
           GROUP BY day ORDER BY day DESC`,
      params,
    ),
  ]);

  return {
    total_payments: totalResult.rows[0]?.total_payments || 0,
    unique_payers: totalResult.rows[0]?.unique_payers || 0,
    first_payment: totalResult.rows[0]?.first_payment,
    last_payment: totalResult.rows[0]?.last_payment,
    by_token: byTokenResult.rows,
    by_method: byMethodResult.rows,
    by_endpoint: byEndpointResult.rows,
    recent: recentResult.rows.map(formatPaymentRow),
    daily: dailyResult.rows,
  };
}

function formatPaymentRow(row: any) {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    payer: row.payer_address,
    token_symbol: row.token_symbol,
    token_address: row.token_address,
    amount: row.amount,
    amount_human: formatAmount(row.amount, getDecimals(row.token_symbol)),
    tx_hash: row.tx_hash,
    network: row.network,
    payment_method: row.payment_method,
    endpoint: row.endpoint,
    created_at: row.created_at,
  };
}

function formatAmount(amount: string, decimals: number): string {
  try {
    const val = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = val / divisor;
    const frac = val % divisor;
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return amount;
  }
}

function getDecimals(symbol: string): number {
  const map: Record<string, number> = {
    CFX: 18, USDT: 18, USDC: 18, BTC: 18, ETH: 18,
    USDT0: 6, AxCNH: 6,
  };
  return map[symbol] ?? 18;
}
