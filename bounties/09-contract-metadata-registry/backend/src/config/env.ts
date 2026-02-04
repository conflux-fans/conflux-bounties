import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  /** Server */
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /** Database */
  DATABASE_URL: z.string().url(),

  /** Redis */
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  /** Blockchain */
  CONFLUX_RPC_URL: z.string().url().default("https://evmtestnet.confluxrpc.com"),
  REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  /** IPFS / Pinata */
  PINATA_JWT: z.string().min(1),
  PINATA_GATEWAY: z.string().url().default("https://gateway.pinata.cloud"),

  /** Moderation */
  MODERATOR_ADDRESSES: z
    .string()
    .transform((s) => s.split(",").map((a) => a.trim().toLowerCase()))
    .default(""),

  /** Webhook */
  WEBHOOK_URL: z.string().url().optional().or(z.literal("")),

  /** Limits */
  MAX_METADATA_KB: z.coerce.number().default(50),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return result.data;
}

export const env = loadEnv();
