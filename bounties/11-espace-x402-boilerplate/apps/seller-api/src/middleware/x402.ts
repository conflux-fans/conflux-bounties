import { createMiddleware } from "hono/factory";
import { v4 as uuidv4 } from "uuid";
import { buildPaymentHeaders, DEFAULT_PAYMENT_TOKEN, INVOICE_EXPIRY_SECONDS, TOKEN_DECIMALS } from "@x402/shared";
import { sql } from "../db/index.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { verifier } from "../lib/verifier.js";
import { scheduleInvoiceExpiry } from "../jobs/invoiceExpiry.js";
import { invoicesCreatedTotal } from "../lib/metrics.js";

// In-memory pricing cache with 60s TTL — avoids DB hit on every request
const pricingCache = new Map<string, { price: string; token: string; description: string; expiresAt: number }>();
const PRICING_CACHE_TTL_MS = 60_000;

async function getPricing(endpoint: string): Promise<{ price: string; token: string; description: string } | undefined> {
  const cached = pricingCache.get(endpoint);
  if (cached && Date.now() < cached.expiresAt) return cached;

  const [row] = await sql`
    SELECT price, token, description FROM endpoint_pricing WHERE endpoint = ${endpoint}
  `;
  if (row) {
    pricingCache.set(endpoint, { ...row, expiresAt: Date.now() + PRICING_CACHE_TTL_MS });
  }
  return row;
}

export const x402Paywall = createMiddleware(async (c, next) => {
  const endpoint = c.req.path;

  // Check if this endpoint has pricing configured (cached)
  const pricing = await getPricing(endpoint);
  if (!pricing) {
    return next(); // free endpoint
  }

  // Check if client is providing a paid invoice ID
  const invoiceId = c.req.header("x-payment-invoice-id");
  if (invoiceId) {
    // Verify the invoice is paid in DB AND bound to this specific endpoint
    const [invoice] = await sql`
      SELECT * FROM invoices WHERE id = ${invoiceId} AND status = 'paid' AND endpoint = ${endpoint}
    `;
    if (invoice) {
      // Bind invoice to payer: require x-payment-payer header matching the original payer
      // to prevent replay by third parties who learn the invoice ID.
      const payerHeader = c.req.header("x-payment-payer");
      if (invoice.payer && payerHeader && payerHeader.toLowerCase() !== invoice.payer.toLowerCase()) {
        return c.json({ error: "Invoice payer mismatch" }, 403);
      }
      c.set("invoice" as never, invoice);
      return next();
    }

    // Check on-chain as fallback
    try {
      const { valid, payer } = await verifier.isInvoicePaid(
        invoiceId,
        BigInt(pricing.price),
        endpoint
      );
      if (valid) {
        await sql`
          UPDATE invoices SET status = 'paid', payer = ${payer}, updated_at = NOW()
          WHERE id = ${invoiceId}
        `;
        return next();
      }
    } catch (err) {
      logger.error({ err, invoiceId }, "On-chain verification failed");
    }
  }

  // Issue a 402 challenge with ERC-3009 payment details
  const newInvoiceId = uuidv4();
  // ARCH-1: Derive nonce from invoiceId so the ERC-3009 authorization is bound
  // to this specific invoice. The client hashes this to bytes32 for EIP-712.
  const nonce = newInvoiceId;
  const expiry = Math.floor(Date.now() / 1000) + INVOICE_EXPIRY_SECONDS;

  await sql`
    INSERT INTO invoices (id, endpoint, amount, token, nonce, expiry, status)
    VALUES (${newInvoiceId}, ${endpoint}, ${pricing.price}, ${pricing.token}, ${nonce}, ${expiry}, 'pending')
  `;
  invoicesCreatedTotal.inc({ endpoint });

  // Schedule automatic expiry via BullMQ (non-blocking)
  scheduleInvoiceExpiry(newInvoiceId, INVOICE_EXPIRY_SECONDS * 1000).catch((err) => {
    logger.warn({ err, invoiceId: newInvoiceId }, "Failed to schedule invoice expiry job");
  });

  const headers = buildPaymentHeaders({
    amount: pricing.price,
    token: pricing.token || DEFAULT_PAYMENT_TOKEN,
    nonce,
    expiry,
    endpoint,
    invoiceId: newInvoiceId,
    description: pricing.description,
    recipient: config.serviceWalletAddress,
    verifierAddress: config.contractAddress,
  });

  const humanAmount = (Number(pricing.price) / 10 ** TOKEN_DECIMALS).toFixed(2);
  return c.json(
    {
      error: "Payment Required",
      message: `This endpoint requires payment of ${humanAmount} USDT0. Sign an ERC-3009 receiveWithAuthorization (to=${config.contractAddress}) and submit to /invoices/${newInvoiceId}/settle`,
      invoiceId: newInvoiceId,
      paymentMethod: "ERC-3009",
      ...headers,
    },
    402,
    headers
  );
});
