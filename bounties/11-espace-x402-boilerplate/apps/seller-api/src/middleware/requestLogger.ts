import { createMiddleware } from "hono/factory";
import { logger } from "../lib/logger.js";
import { sql } from "../db/index.js";

export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const path = c.req.path;
  const status = c.res.status;

  logger.info({ method: c.req.method, path, status, ms });

  // Persist to usage_logs for analytics (fire-and-forget, non-blocking)
  const apiKeyId = c.req.header("x-api-key") || null;
  const invoiceId = c.req.header("x-payment-invoice-id") || null;
  sql`
    INSERT INTO usage_logs (endpoint, status_code, response_time_ms, api_key_id, invoice_id)
    VALUES (${path}, ${status}, ${ms}, ${apiKeyId ? sql`(SELECT id FROM api_keys WHERE key = ${apiKeyId} LIMIT 1)` : null}, ${invoiceId})
  `.catch((err) => {
    logger.warn({ err }, "Failed to persist usage log");
  });
});
