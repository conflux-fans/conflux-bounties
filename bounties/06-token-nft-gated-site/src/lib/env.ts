import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SIWC_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "localhost")),
  CONFLUX_RPC_URL: z.string().url().optional(),
  CONFLUX_TESTNET_RPC_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  ADMIN_WALLETS: z.string().optional(),
  CAPTCHA_SECRET: z.string().optional(),
  CAPTCHA_SITE_KEY: z.string().optional(),
  DEFAULT_RULES_JSON: z.string().optional(),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10),
  RATE_LIMIT_LOGIN_WINDOW_SEC: z.coerce.number().default(60),
  SESSION_MAX_DAYS: z.coerce.number().default(7),
  ASSET_SIGNING_SECRET: z.string().min(32).optional(),
  ASSET_URL_TTL_SEC: z.coerce.number().default(300),
  ABUSE_WEBHOOK_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function getEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export function parseAdminWallets(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
  );
}
