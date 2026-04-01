/**
 * Redis subscriber that logs all invoice lifecycle events.
 * Uses PSUBSCRIBE on invoice.* and dispute.* channels.
 * Requires a separate Redis connection (subscribe mode).
 */
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export async function startEventLogger() {
  try {
    const ioredis = await import("ioredis");
    const Redis = ioredis.default;
    const sub = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await sub.connect();

    await sub.psubscribe("invoice.*", "dispute.*");

    sub.on("pmessage", (_pattern: string, channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);
        logger.info({ channel, ...payload }, `Event: ${channel}`);
      } catch {
        logger.info({ channel, message }, `Event: ${channel} (raw)`);
      }
    });

    logger.info("Event logger subscribed to invoice.* and dispute.* channels");
    return sub;
  } catch (err) {
    logger.warn({ err }, "Event logger: could not connect to Redis — skipping");
    return null;
  }
}
