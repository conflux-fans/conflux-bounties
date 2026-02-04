import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env";

/**
 * Register rate-limiting plugin with per-IP and per-wallet limits.
 */
export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    redis: undefined, // Uses in-memory store; swap to Redis in production
    keyGenerator: (request) => {
      // Use wallet address for write routes, IP for reads
      return (request as any).walletAddress || request.ip;
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
    }),
  });
}
