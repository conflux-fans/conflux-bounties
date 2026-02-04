import { createPublicClient, http, defineChain } from 'viem';

/**
 * Conflux eSpace chain definition for viem.
 * Chain ID 1030, uses the public RPC endpoint by default.
 */
export const confluxESpace = defineChain({
  id: Number(process.env.CHAIN_ID ?? 1030),
  name: 'Conflux eSpace',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.CONFLUX_RPC_URL ?? 'https://evm.confluxrpc.com'],
    },
  },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evm.confluxscan.io' },
  },
});

/**
 * Shared viem public client connected to Conflux eSpace.
 * Used by the block fetcher, log decoder, and backfill pipeline.
 */
export const viemClient = createPublicClient({
  chain: confluxESpace,
  transport: http(process.env.CONFLUX_RPC_URL ?? 'https://evm.confluxrpc.com', {
    batch: true,
    retryCount: 3,
    retryDelay: 1000,
  }),
});
