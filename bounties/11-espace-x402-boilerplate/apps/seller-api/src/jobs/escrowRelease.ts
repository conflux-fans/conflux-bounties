import { Queue, Worker } from "bullmq";
import { sql } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { config } from "../lib/config.js";
import { verifier } from "../lib/verifier.js";
import { publish } from "../lib/eventBus.js";

export const escrowReleaseQueue = new Queue("escrow-release", {
  connection: { url: config.redisUrl },
});

export function startEscrowReleaseWorker() {
  const worker = new Worker(
    "escrow-release",
    async (job) => {
      const { invoiceId } = job.data;
      const [invoice] = await sql`SELECT status, onchain_invoice_id FROM invoices WHERE id = ${invoiceId}`;
      if (!invoice || invoice.status !== "paid") {
        logger.info({ invoiceId, status: invoice?.status }, "Skipping auto-release (not in paid state)");
        return;
      }
      if (!invoice.onchain_invoice_id) {
        logger.error({ invoiceId }, "Cannot auto-release: missing onchain_invoice_id");
        return;
      }

      try {
        const txHash = await verifier.release(invoice.onchain_invoice_id as `0x${string}`);
        await verifier.waitForTx(txHash);

        await sql`
          UPDATE invoices SET status = 'released', tx_hash = ${txHash}, updated_at = NOW()
          WHERE id = ${invoiceId}
        `;

        logger.info({ invoiceId, txHash }, "Escrow auto-released");
        publish("invoice.released", { invoiceId, txHash });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // If already released on-chain (e.g. manual release), just update DB
        if (msg.includes("already released")) {
          await sql`UPDATE invoices SET status = 'released', updated_at = NOW() WHERE id = ${invoiceId}`;
          logger.info({ invoiceId }, "Escrow already released on-chain, updated DB");
          return;
        }
        // If already refunded, skip
        if (msg.includes("already refunded")) {
          logger.info({ invoiceId }, "Escrow was refunded, skipping auto-release");
          return;
        }
        throw err;
      }
    },
    {
      connection: { url: config.redisUrl },
    }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, invoiceId: job?.data.invoiceId, err }, "Escrow auto-release job failed");
  });

  return worker;
}

export async function scheduleEscrowRelease(invoiceId: string, delayMs: number) {
  // Add a small buffer (5s) to ensure the on-chain escrow period has definitely passed
  const delay = Math.max(0, delayMs + 5_000);
  await escrowReleaseQueue.add("release", { invoiceId }, {
    delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
  });
  logger.info({ invoiceId, delayMs: delay }, "Scheduled escrow auto-release");
}
