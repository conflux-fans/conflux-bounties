import dotenv from "dotenv";
import { z } from "zod";
import { type Hex } from "viem";

// Load environment variables from .env file
dotenv.config();

// Define environment variable schema
const envSchema = z.object({
  PRIVATE_KEY: z.string().optional(),
});

// Parse and validate environment variables
const env = envSchema.safeParse(process.env);

// Format private key with 0x prefix if it exists
const formatPrivateKey = (key?: string): string | undefined => {
  if (!key) return undefined;

  // Ensure the private key has 0x prefix
  return key.startsWith("0x") ? key : `0x${key}`;
};

// Runtime configuration that can be updated
let runtimeConfig = {
  privateKey: env.success ? formatPrivateKey(env.data.PRIVATE_KEY) : undefined,
};

// Export validated environment variables with formatted private key
export const config = {
  get privateKey() {
    return runtimeConfig.privateKey;
  },
  set privateKey(key: string | undefined) {
    runtimeConfig.privateKey = formatPrivateKey(key);
  },
};

/**
 * Get the private key from environment variable as a Hex type for viem.
 * Returns undefined if the PRIVATE_KEY environment variable is not set.
 * @returns Private key from environment variable as Hex or undefined
 */
export function getPrivateKeyAsHex(): Hex | undefined {
  const key = config.privateKey as Hex | undefined;
  return key;
}

/**
 * Update the private key at runtime (useful for URL-based MCP connections)
 * @param privateKey - The new private key to set
 */
export function updatePrivateKey(privateKey: string): void {
  config.privateKey = privateKey;
}
