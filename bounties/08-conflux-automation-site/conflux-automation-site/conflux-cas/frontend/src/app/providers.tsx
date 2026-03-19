'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  type Config,
  createConfig,
  http,
  injected,
  WagmiProvider as WagmiProviderBase,
} from 'wagmi';
import { AuthProvider } from '@/lib/auth-context';
import { PoolsProvider } from '@/lib/pools-context';

// Conflux eSpace chains
const espaceTestnet = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmtestnet.confluxrpc.com'] } },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evmtestnet.confluxscan.io' },
  },
  testnet: true,
} as const;

const espaceMainnet = {
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm.confluxrpc.com'] } },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evm.confluxscan.io' },
  },
} as const;

export const wagmiConfig: Config = createConfig({
  chains: [espaceTestnet, espaceMainnet],
  // Register the injected (MetaMask, Fluent, etc.) connector so wagmi can
  // automatically reconnect it on page refresh without requiring a new
  // connect() call.  Without this, wagmi's persisted connection finds no
  // matching connector and drops the session, forcing a re-sign every time.
  connectors: [injected()],
  // Poll every 30 s for block updates. This is the global default for all wagmi
  // hooks (useBalance, block subscriptions, etc.). 2 s was causing 30+ RPC calls
  // per minute and burning the testnet quota quickly.
  // waitForTransactionReceipt in StrategyBuilder passes its own pollingInterval: 2_000
  // override, so receipt confirmation speed is unaffected by this setting.
  pollingInterval: 30_000,
  transports: {
    // batch: { wait: 16 } coalesces concurrent readContract calls (e.g. the N
    // balanceOf calls in usePoolTokens) into a single JSON-RPC batch request.
    // batch.size: 20 caps each JSON-RPC batch request at 20 calls to avoid
    // 'Too many requests (exceeds N)' errors on Conflux testnet.
    [espaceTestnet.id]: http('https://evmtestnet.confluxrpc.com', {
      batch: { wait: 16, batchSize: 5 },
    }),
    [espaceMainnet.id]: http('https://evm.confluxrpc.com', {
      batch: { wait: 16, batchSize: 5 },
    }),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch immediately on window focus or reconnect — reduces RPC
      // calls when the user switches tabs. Data refreshes on the normal
      // pollingInterval (30 s) instead.
      staleTime: 30_000,
      gcTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function WagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PoolsProvider>{children}</PoolsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProviderBase>
  );
}
