/**
 * Invoice lifecycle service for x402 payments
 *
 * Manages the x402_invoices table:
 *   - createInvoice()   — record a new 402 challenge (status: pending)
 *   - markInvoicePaid() — mark invoice as paid after settlement
 *   - expireInvoices()  — expire all pending invoices past their deadline
 *
 * Integration (add to seller/src/middleware/x402.ts):
 *
 *   import { createInvoice, markInvoicePaid } from '../services/invoices.js';
 *
 *   // In send402() after generating invoiceId:
 *   createInvoice(invoiceId, token.symbol, network.caip2, endpoint, expiry).catch(() => {});
 *
 *   // In verifyAndSettle() after successful settlement:
 *   markInvoicePaid(invoiceId).catch(() => {});
 *
 * @package x402-fullstack
 */

import { db } from '../config/database.js';

/**
 * Record a new invoice when a 402 challenge is issued.
 * Fire-and-forget safe — errors are logged but never thrown.
 */
export async function createInvoice(
  invoiceId: string,
  tokenSymbol: string,
  amount: string,
  chainId: number,
  network: string,
  endpoint: string,
  expiresInSeconds: number = 3600,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO x402_invoices (invoice_id, token_symbol, amount, chain_id, endpoint, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + INTERVAL '1 second' * $6)
       ON CONFLICT (invoice_id) DO NOTHING`,
      [invoiceId, tokenSymbol, amount, chainId, endpoint, expiresInSeconds],
    );
  } catch (err: any) {
    console.error('[invoices] Create error:', err.message);
  }
}

/**
 * Mark an invoice as paid after successful settlement.
 * Fire-and-forget safe — errors are logged but never thrown.
 */
export async function markInvoicePaid(
  invoiceId: string,
  payerAddress?: string,
): Promise<void> {
  try {
    await db.query(
      `UPDATE x402_invoices
       SET status = 'paid', payer = COALESCE($2, payer)
       WHERE invoice_id = $1 AND status = 'pending'`,
      [invoiceId, payerAddress || null],
    );
  } catch (err: any) {
    console.error('[invoices] Mark paid error:', err.message);
  }
}

/**
 * Expire all pending invoices that have passed their deadline.
 * Returns the number of expired invoices.
 */
export async function expireInvoices(): Promise<number> {
  try {
    const result = await db.query(
      `UPDATE x402_invoices
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  } catch (err: any) {
    console.error('[invoices] Expire error:', err.message);
    return 0;
  }
}

/**
 * Get invoice statistics (for admin/monitoring).
 */
export async function getInvoiceStats(): Promise<{
  pending: number;
  paid: number;
  expired: number;
}> {
  try {
    const result = await db.query(
      `SELECT status, count(*)::int AS count
       FROM x402_invoices
       GROUP BY status`,
    );
    const stats = { pending: 0, paid: 0, expired: 0 };
    for (const row of result.rows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  } catch (err: any) {
    console.error('[invoices] Stats error:', err.message);
    return { pending: 0, paid: 0, expired: 0 };
  }
}
