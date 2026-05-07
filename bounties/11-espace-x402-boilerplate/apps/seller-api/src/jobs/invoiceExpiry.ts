import { Queue, Worker } from "bullmq";
import { sql } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { config } from "../lib/config.js";
import { publish } from "../lib/eventBus.js";

export const invoiceExpiryQueue = new Queue("invoice-expiry", {
  connection: { url: config.redisUrl },
});

export function startInvoiceExpiryWorker() {
  const worker = new Worker(
    "invoice-expiry",
    async (job) => {
      const { invoiceId } = job.data;
      const [invoice] = await sql`SELECT status FROM invoices WHERE id = ${invoiceId}`;
      if (invoice && invoice.status === "pending") {
        await sql`UPDATE invoices SET status = 'expired', updated_at = NOW() WHERE id = ${invoiceId}`;
        publish("invoice.expired", { invoiceId });
        logger.info({ invoiceId }, "Invoice expired");
      }
    },
    { connection: { url: config.redisUrl } }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Invoice expiry job failed");
  });

  return worker;
}

export async function scheduleInvoiceExpiry(invoiceId: string, delayMs: number) {
  await invoiceExpiryQueue.add("expire", { invoiceId }, { delay: delayMs });
}
