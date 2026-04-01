/**
 * Redis pub/sub event bus for invoice lifecycle events.
 * Fire-and-forget: errors are logged but never thrown.
 */
import { config } from "./config.js";
import { logger } from "./logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publishClient: any = null;

async function getPublishClient() {
  if (publishClient) return publishClient;
  try {
    // ioredis is available as a transitive dependency of bullmq
    const ioredis = await import("ioredis");
    const Redis = ioredis.default;
    publishClient = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await publishClient.connect();
    logger.info("Event bus publish client connected");
  } catch (err) {
    logger.warn({ err }, "Event bus: could not connect to Redis — events will be logged only");
    publishClient = null;
  }
  return publishClient;
}

export type InvoiceEvent =
  | "invoice.paid"
  | "invoice.expired"
  | "invoice.refunded"
  | "invoice.released"
  | "dispute.opened"
  | "dispute.resolved";

export interface EventPayload {
  invoiceId: string;
  status?: string;
  payer?: string;
  txHash?: string;
  disputeId?: string;
  resolution?: string;
  timestamp: string;
}

/**
 * Publish an event to the Redis event bus.
 * Fire-and-forget — never throws.
 */
export async function publish(channel: InvoiceEvent, payload: Omit<EventPayload, "timestamp">) {
  const fullPayload: EventPayload = { ...payload, timestamp: new Date().toISOString() };
  logger.info({ channel, ...fullPayload }, "Event published");

  try {
    const client = await getPublishClient();
    if (client) {
      await client.publish(channel, JSON.stringify(fullPayload));
    }
  } catch (err) {
    logger.warn({ err, channel }, "Event bus publish failed");
  }
}
