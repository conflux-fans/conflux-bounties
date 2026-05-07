import { logger } from "./logger.js";

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

export async function sendAlert(event: string, details: Record<string, unknown>) {
  logger.warn({ event, ...details }, `Alert: ${event}`);

  if (!ALERT_WEBHOOK_URL) return;

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...details,
      }),
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to send alert webhook");
  }
}
