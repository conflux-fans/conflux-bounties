import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";
import { config } from "./lib/config.js";
import { sql } from "./db/index.js";
import { startInvoiceExpiryWorker } from "./jobs/invoiceExpiry.js";
import { startEventLogger } from "./jobs/eventLogger.js";

const port = Number(process.env.API_PORT) || 4000;

// Update seed pricing rows with the actual token address from env
// (schema.sql seeds with 0x0 placeholder)
if (config.tokenAddress !== "0x0000000000000000000000000000000000000000") {
  sql`UPDATE endpoint_pricing SET token = ${config.tokenAddress} WHERE token = '0x0000000000000000000000000000000000000000'`
    .then((res) => { if (res.count > 0) logger.info({ token: config.tokenAddress, updated: res.count }, "Updated seed pricing with USDT0 address"); })
    .catch((err) => logger.warn({ err }, "Failed to update seed pricing token address"));
}

// Start BullMQ worker for automatic invoice expiration
try {
  startInvoiceExpiryWorker();
  logger.info("Invoice expiry worker started");
} catch (err) {
  logger.warn({ err }, "Invoice expiry worker failed to start (Redis may be unavailable)");
}

// Start event logger (subscribes to invoice.* and dispute.* channels)
startEventLogger().catch((err) =>
  logger.warn({ err }, "Event logger failed to start")
);

serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Seller API running on http://localhost:${info.port}`);
});
