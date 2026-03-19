'use client';

/**
 * PoolsProvider – singleton that owns the usePoolTokens instance for the
 * entire app.
 *
 * Why this exists:
 *   Previously, usePoolTokens was called inside StrategyBuilder, which means
 *   the /api/pools fetch and balance RPC calls only started when the modal was
 *   opened — after the user had already signed in.
 *
 * With this provider:
 *   - /api/pools metadata fetch starts on first page paint (no auth required)
 *   - Balance enrichment starts as soon as the wallet connects (address
 *     becomes non-null), independently of JWT
 *   - StrategyBuilder gets instant token data when the modal opens (either
 *     from localStorage cache or the already-running fetch)
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAccount } from 'wagmi';
import { type UsePoolTokensResult, usePoolTokens } from '@/hooks/usePoolTokens';

const PoolsContext = createContext<UsePoolTokensResult | null>(null);

export function usePoolsContext(): UsePoolTokensResult {
  const ctx = useContext(PoolsContext);
  if (!ctx)
    throw new Error('usePoolsContext must be used inside PoolsProvider');
  return ctx;
}

/**
 * Must be rendered inside WagmiProvider so useAccount() is available.
 * Place it in providers.tsx after WagmiProviderBase + AuthProvider.
 */
export function PoolsProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();

  // Avoid SSR mismatch: useAccount returns undefined on server. Start the
  // fetch on mount (client only) so the address read is always accurate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pass address once mounted so:
  //   - Before wallet connect  → address=undefined → pools fetch, no balances
  //   - After wallet connect   → address=0x…      → pools fetch + balances
  //   - After sign-in (JWT)    → same address, already loaded
  const result = usePoolTokens(mounted ? address : undefined);

  return (
    <PoolsContext.Provider value={result}>{children}</PoolsContext.Provider>
  );
}
