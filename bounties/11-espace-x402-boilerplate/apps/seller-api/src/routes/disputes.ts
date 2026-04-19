import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { verifier } from "../lib/verifier.js";
import { sendAlert } from "../lib/alerts.js";
import { publish } from "../lib/eventBus.js";

const disputeSchema = z.object({
  invoiceId: z.string().uuid(),
  requester: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  reason: z.string().min(1).max(2000),
});

const resolveSchema = z.object({
  resolution: z.enum(["approved", "rejected"]),
  adminNote: z.string().max(2000).optional(),
});

export const disputeRoutes = new Hono();

// Submit a dispute (public — requires wallet address matching invoice payer)
disputeRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = disputeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const { invoiceId, requester, reason } = parsed.data;

  // Validate invoice exists and is paid
  const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${invoiceId}`;
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  if (invoice.status !== "paid") {
    return c.json({ error: `Cannot dispute invoice with status '${invoice.status}'` }, 400);
  }

  // Verify requester is the payer
  if (invoice.payer?.toLowerCase() !== requester.toLowerCase()) {
    return c.json({ error: "Only the payer of this invoice can submit a dispute" }, 403);
  }

  // Check for existing open dispute on this invoice
  const [existing] = await sql`
    SELECT id FROM disputes WHERE invoice_id = ${invoiceId} AND status = 'open'
  `;
  if (existing) {
    return c.json({ error: "An open dispute already exists for this invoice", disputeId: existing.id }, 409);
  }

  const [dispute] = await sql`
    INSERT INTO disputes (invoice_id, requester, reason)
    VALUES (${invoiceId}, ${requester.toLowerCase()}, ${reason})
    RETURNING *
  `;

  publish("dispute.opened", { invoiceId, disputeId: dispute.id });
  logger.info({ disputeId: dispute.id, invoiceId, requester }, "Dispute opened");

  return c.json({ dispute }, 201);
});

// Get a single dispute by ID (public)
disputeRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [dispute] = await sql`SELECT * FROM disputes WHERE id = ${id}`;
  if (!dispute) return c.json({ error: "Dispute not found" }, 404);
  return c.json({ dispute });
});

// List disputes (admin — supports ?status=open filter)
disputeRoutes.get("/", adminAuth, async (c) => {
  const status = c.req.query("status");
  const disputes = status
    ? await sql`SELECT * FROM disputes WHERE status = ${status} ORDER BY created_at DESC`
    : await sql`SELECT * FROM disputes ORDER BY created_at DESC`;
  return c.json({ disputes, count: disputes.length });
});

// Resolve a dispute (admin only)
disputeRoutes.post("/:id/resolve", adminAuth, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const { resolution, adminNote } = parsed.data;

  const [dispute] = await sql`SELECT * FROM disputes WHERE id = ${id}`;
  if (!dispute) return c.json({ error: "Dispute not found" }, 404);
  if (dispute.status !== "open") {
    return c.json({ error: `Dispute already resolved with status '${dispute.status}'` }, 400);
  }

  // If approved, trigger refund
  let refundTxHash: string | undefined;
  if (resolution === "approved") {
    const [invoice] = await sql`SELECT * FROM invoices WHERE id = ${dispute.invoice_id}`;
    if (!invoice || invoice.status !== "paid") {
      return c.json({ error: "Invoice is no longer in paid status — cannot refund" }, 400);
    }

    try {
      const txHash = await verifier.refund(dispute.invoice_id);
      await verifier.waitForTx(txHash);
      refundTxHash = txHash;

      // Retry DB write up to 3 times — refund is already confirmed on-chain
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await sql`
            UPDATE invoices SET status = 'refunded', tx_hash = ${txHash}, updated_at = NOW()
            WHERE id = ${dispute.invoice_id}
          `;
          break;
        } catch (dbErr) {
          logger.error({ dbErr, invoiceId: dispute.invoice_id, attempt }, "DB update failed after refund");
          if (attempt === 2) {
            logger.error({ invoiceId: dispute.invoice_id, txHash, disputeId: id }, "CRITICAL: refund confirmed on-chain but DB update failed after 3 retries");
            sendAlert("db_sync_failure", { invoiceId: dispute.invoice_id, txHash });
          }
        }
      }
      publish("invoice.refunded", { invoiceId: dispute.invoice_id, txHash });
      logger.info({ disputeId: id, invoiceId: dispute.invoice_id, txHash }, "Dispute approved — refund issued");
    } catch (err) {
      logger.error({ err, disputeId: id }, "Refund failed during dispute resolution");
      sendAlert("refund_failed", { invoiceId: dispute.invoice_id, disputeId: id, error: String(err) });
      return c.json({ error: "Refund transaction failed", details: String(err) }, 500);
    }
  }

  // Update dispute status
  await sql`
    UPDATE disputes
    SET status = ${resolution}, admin_note = ${adminNote || null}, resolved_at = NOW()
    WHERE id = ${id}
  `;

  publish("dispute.resolved", {
    invoiceId: dispute.invoice_id,
    disputeId: id,
    resolution,
  });

  const [updated] = await sql`SELECT * FROM disputes WHERE id = ${id}`;
  return c.json({ dispute: updated, refundTxHash });
});
