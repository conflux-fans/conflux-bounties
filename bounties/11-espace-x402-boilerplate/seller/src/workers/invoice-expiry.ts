#!/usr/bin/env node
/**
 * Invoice expiry worker — standalone script
 *
 * Expires all pending invoices that have passed their deadline.
 * Run via cron, Docker, or manually:
 *
 *   npx tsx seller/src/workers/invoice-expiry.ts
 *
 * Recommended cron schedule (every 5 minutes):
 *   */5 * * * * cd /path/to/x402-fullstack && npx tsx seller/src/workers/invoice-expiry.ts
 *
 * @package x402-fullstack
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { db } from '../config/database.js';
import { expireInvoices, getInvoiceStats } from '../services/invoices.js';

async function main(): Promise<void> {
  const expired = await expireInvoices();

  if (expired > 0) {
    console.log(`[invoice-expiry] Expired ${expired} invoice(s)`);
  }

  const stats = await getInvoiceStats();
  console.log(`[invoice-expiry] Stats: ${stats.pending} pending, ${stats.paid} paid, ${stats.expired} expired`);

  await db.end();
}

main().catch((err) => {
  console.error('[invoice-expiry] Fatal:', err.message);
  process.exit(1);
});
