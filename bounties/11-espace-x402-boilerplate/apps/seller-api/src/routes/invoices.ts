import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { verifyTypedData } from "viem";
import { RECEIVE_WITH_AUTHORIZATION_TYPES, getERC3009Domain, hashNonce } from "@x402/shared";
import { sql } from "../db/index.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { sendAlert } from "../lib/alerts.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { verifier } from "../lib/verifier.js";
import { paymentsTotal, paymentAmountTotal, facilitatorGasSaved } from "../lib/metrics.js";
import { publish } from "../lib/eventBus.js";

// Stricter rate limit for settlement — each call triggers an on-chain tx (facilitator pays gas)
const SETTLE_MAX_PER_MINUTE = 5;
const settleRequests = new Map<string, { count: number; resetAt: number }>();

// Prune stale entries every 60s to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of settleRequests) {
    if (now > entry.resetAt) settleRequests.delete(key);
  }
}, 60_000).unref();

const settleRateLimit = createMiddleware(async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || "unknown";
  const now = Date.now();
  let entry = settleRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    settleRequests.set(ip, entry);
  }
  entry.count++;
  if (entry.count > SETTLE_MAX_PER_MINUTE) {
    return c.json({ error: "Too many settlement attempts. Try again later." }, 429);
  }
  return next();
});

/** Clear settle rate limit state (for testing). */
export function resetSettleRateLimit() {
  settleRequests.clear();
}

export const invoiceRoutes = new Hono();

const ESCROW_HOURS = 24;

/** Enrich an invoice record with escrow timing fields. */
function withEscrowTiming(invoice: Record<string, any>) {
  if (invoice.status === "paid" && invoice.updated_at) {
    const paidAt = new Date(invoice.updated_at).getTime();
    const releaseAt = paidAt + ESCROW_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    return {
      ...invoice,
      paid_at: new Date(paidAt).toISOString(),
      release_at: new Date(releaseAt).toISOString(),
      escrow_remaining_ms: Math.max(0, releaseAt - now),
      escrow_released: now >= releaseAt,
    };
  }
  return invoice;
}

// Get invoice status
invoiceRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ invoice: withEscrowTiming(invoice) });
});

// Settle: accept a signed ERC-3009 authorization and submit on-chain via facilitator
invoiceRoutes.post("/:id/settle", settleRateLimit, async (c) => {
  const id = c.req.param("id");
  const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  if (invoice.status === "paid") return c.json({ invoice, verified: true });

  // Check expiry
  if (Date.now() / 1000 > Number(invoice.expiry)) {
    await sql`UPDATE invoices SET status = 'expired', updated_at = NOW() WHERE id = ${id}`;
    publish("invoice.expired", { invoiceId: id });
    return c.json({ error: "Invoice expired" }, 410);
  }

  const body = await c.req.json().catch(() => ({}));
  const auth = body.authorization;
  if (!auth || !auth.from || !auth.to || !auth.v || !auth.r || !auth.s) {
    return c.json(
      {
        error:
          "Missing ERC-3009 signed authorization. Expected { authorization: { from, to, value, validAfter, validBefore, nonce, v, r, s } }",
      },
      400
    );
  }

  // Validate authorization value matches invoice amount
  if (BigInt(auth.value) < BigInt(invoice.amount)) {
    return c.json({ error: "Authorization value too low" }, 400);
  }

  // Validate `to` is the verifier contract (ReceiveWithAuthorization sends funds there first)
  if (auth.to.toLowerCase() !== config.contractAddress.toLowerCase()) {
    return c.json({ error: "Authorization 'to' must be the X402PaymentVerifier contract address" }, 400);
  }

  // ARCH-1: Verify the ERC-3009 nonce is derived from this invoiceId.
  // This binds the signed authorization to this specific invoice, preventing
  // payment misbinding (audit finding F-01).
  const expectedNonce = hashNonce(id);
  if (auth.nonce !== expectedNonce) {
    return c.json({ error: "Authorization nonce does not match invoice — signature is not bound to this invoice" }, 400);
  }

  // Pre-validate EIP-712 signature off-chain before spending gas on-chain
  try {
    const tokenDomain = getERC3009Domain(config.tokenAddress, config.network);
    const valid = await verifyTypedData({
      address: auth.from as `0x${string}`,
      domain: {
        name: tokenDomain.name,
        version: tokenDomain.version,
        chainId: BigInt(config.chainId),
        verifyingContract: config.tokenAddress,
      },
      types: RECEIVE_WITH_AUTHORIZATION_TYPES,
      primaryType: "ReceiveWithAuthorization",
      message: {
        from: auth.from as `0x${string}`,
        to: auth.to as `0x${string}`,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter ?? 0),
        validBefore: BigInt(auth.validBefore ?? invoice.expiry),
        nonce: (auth.nonce as `0x${string}`),
      },
      signature: `0x${Buffer.from([
        ...Buffer.from((auth.r as string).slice(2), "hex"),
        ...Buffer.from((auth.s as string).slice(2), "hex"),
        auth.v,
      ]).toString("hex")}` as `0x${string}`,
    });
    if (!valid) {
      facilitatorGasSaved.inc({ reason: "invalid_signature" });
      return c.json({ error: "Invalid EIP-712 signature — rejected before on-chain submission" }, 400);
    }
  } catch (sigErr) {
    facilitatorGasSaved.inc({ reason: "signature_error" });
    logger.warn({ sigErr, invoiceId: id }, "Off-chain signature verification failed");
    return c.json({ error: "Invalid EIP-712 signature" }, 400);
  }

  try {
    // Submit on-chain via facilitator wallet
    const txHash = await verifier.settle(
      id,
      config.tokenAddress,
      invoice.endpoint,
      auth
    );

    // Wait for on-chain confirmation before updating DB
    await verifier.waitForTx(txHash);

    // Retry DB write up to 3 times to prevent state divergence
    // (payment confirmed on-chain but DB still shows 'pending')
    for (let dbAttempt = 0; dbAttempt < 3; dbAttempt++) {
      try {
        await sql`
          UPDATE invoices SET status = 'paid', payer = ${auth.from}, tx_hash = ${txHash}, updated_at = NOW()
          WHERE id = ${id}
        `;
        break;
      } catch (dbErr) {
        logger.error({ dbErr, invoiceId: id, attempt: dbAttempt }, "DB update failed after settlement");
        if (dbAttempt === 2) {
          // Payment succeeded on-chain but DB is stale — client can use /verify to recover
          logger.error({ invoiceId: id, txHash }, "CRITICAL: on-chain payment confirmed but DB update failed after 3 retries");
          sendAlert("db_sync_failure", { invoiceId: id, txHash });
        }
      }
    }

    logger.info({ invoiceId: id, txHash, payer: auth.from }, "Invoice settled on-chain");
    publish("invoice.paid", { invoiceId: id, payer: auth.from, txHash });
    paymentsTotal.inc({ endpoint: invoice.endpoint, status: "settled" });
    paymentAmountTotal.inc({ endpoint: invoice.endpoint }, Number(invoice.amount));
    return c.json({
      invoice: { ...invoice, status: "paid", payer: auth.from, tx_hash: txHash },
      verified: true,
      txHash,
    });
  } catch (err) {
    logger.error({ err, invoiceId: id }, "Settlement failed");
    sendAlert("settlement_failed", { invoiceId: id, error: String(err) });
    const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    return c.json({
      error: "Settlement failed",
      ...(isDev ? { details: String(err) } : {}),
    }, 500);
  }
});

// Release escrowed funds to the seller after the 24h grace period
invoiceRoutes.post("/:id/release", adminAuth, async (c) => {
  const id = c.req.param("id");
  const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  if (invoice.status !== "paid") {
    return c.json({ error: `Cannot release invoice with status '${invoice.status}'` }, 400);
  }

  try {
    const txHash = await verifier.release(id);
    await verifier.waitForTx(txHash);

    await sql`
      UPDATE invoices SET status = 'released', tx_hash = ${txHash}, updated_at = NOW()
      WHERE id = ${id}
    `;

    logger.info({ invoiceId: id, txHash }, "Escrow released to seller");
    publish("invoice.released", { invoiceId: id, txHash });
    return c.json({
      invoice: { ...invoice, status: "released", tx_hash: txHash },
      txHash,
    });
  } catch (err) {
    logger.error({ err, invoiceId: id }, "Release failed");
    sendAlert("release_failed", { invoiceId: id, error: String(err) });
    const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    return c.json({
      error: "Release failed",
      ...(isDev ? { details: String(err) } : {}),
    }, 500);
  }
});

// Refund a paid invoice (admin only — requires authentication)
invoiceRoutes.post("/:id/refund", adminAuth, async (c) => {
  const id = c.req.param("id");
  const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  if (invoice.status !== "paid") {
    return c.json({ error: `Cannot refund invoice with status '${invoice.status}'` }, 400);
  }

  try {
    const txHash = await verifier.refund(id);
    await verifier.waitForTx(txHash);

    await sql`
      UPDATE invoices SET status = 'refunded', tx_hash = ${txHash}, updated_at = NOW()
      WHERE id = ${id}
    `;

    logger.info({ invoiceId: id, txHash }, "Invoice refunded");
    publish("invoice.refunded", { invoiceId: id, txHash });
    return c.json({
      invoice: { ...invoice, status: "refunded", tx_hash: txHash },
      txHash,
    });
  } catch (err) {
    logger.error({ err, invoiceId: id }, "Refund failed");
    sendAlert("refund_failed", { invoiceId: id, error: String(err) });
    const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    return c.json({
      error: "Refund failed",
      ...(isDev ? { details: String(err) } : {}),
    }, 500);
  }
});

// Poll / verify invoice payment on-chain
invoiceRoutes.post("/:id/verify", async (c) => {
  const id = c.req.param("id");
  const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  if (invoice.status === "paid") return c.json({ invoice, verified: true });

  // Check expiry
  if (Date.now() / 1000 > Number(invoice.expiry)) {
    await sql`UPDATE invoices SET status = 'expired', updated_at = NOW() WHERE id = ${id}`;
    publish("invoice.expired", { invoiceId: id });
    return c.json({ error: "Invoice expired" }, 410);
  }

  try {
    const { valid, payer } = await verifier.isInvoicePaid(
      id,
      BigInt(invoice.amount),
      invoice.endpoint
    );
    if (valid) {
      await sql`
        UPDATE invoices SET status = 'paid', payer = ${payer}, updated_at = NOW()
        WHERE id = ${id}
      `;
      publish("invoice.paid", { invoiceId: id, payer: payer ?? undefined });
      return c.json({ invoice: { ...invoice, status: "paid", payer }, verified: true });
    }
  } catch (err) {
    logger.error({ err, invoiceId: id }, "Verification error");
  }

  return c.json({ invoice, verified: false });
});

// List invoices (admin)
invoiceRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);

  const rows = status
    ? await sql`SELECT * FROM invoices WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`
    : await sql`SELECT * FROM invoices ORDER BY created_at DESC LIMIT ${limit}`;

  const invoices = rows.map(withEscrowTiming);
  return c.json({ invoices, count: invoices.length });
});
