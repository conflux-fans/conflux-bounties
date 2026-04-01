import { getNetworkConfig } from "@x402/shared";

const networkConfig = getNetworkConfig();

export const config = {
  port: Number(process.env.API_PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || "postgresql://x402:x402pass@localhost:5432/x402_db",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  contractAddress: (process.env.X402_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  serviceWalletKey: process.env.SERVICE_WALLET_KEY as `0x${string}` | undefined,
  serviceWalletAddress: process.env.SERVICE_WALLET_ADDRESS || "0xE90fA6AA4F03Ae276049B328d62fF7702b6242ba",
  rpcUrl: networkConfig.rpcUrl,
  tokenAddress: networkConfig.paymentToken as `0x${string}`,
  adminApiKey: process.env.ADMIN_API_KEY,
  network: networkConfig.network,
  chainId: networkConfig.chainId,
  isTestnet: networkConfig.isTestnet,
  explorerUrl: networkConfig.explorerUrl,
} as const;
