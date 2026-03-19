'use client';

/**
 * useTokenPrice – fetches the live Swappi pair price and USD prices for two tokens.
 *
 * - Swappi price: calls `router.getAmountsOut(1 tokenIn, [tokenIn, tokenOut])`
 *   Returns human-readable price in "tokenOut per 1 tokenIn".
 * - USD prices: queried from DeFiLlama's free price API.
 *   Returns null for testnet tokens that aren't indexed.
 *
 * CFX_NATIVE_ADDRESS (0xEeee…) is automatically mapped to WCFX for all queries.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Address,
  createPublicClient,
  formatUnits,
  getAddress,
  http,
} from 'viem';
import { confluxESpace, confluxESpaceTestnet } from 'viem/chains';
import { CFX_NATIVE_ADDRESS, wcfxAddress } from './usePoolTokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const SWAPPI_ROUTER: Record<string, string> = {
  testnet: '0x873789aaF553FD0B4252d0D2b72C6331c47aff2E',
  mainnet: '0xE37B52296b0bAA91412cD0Cd97975B0805037B84', // Swappi v2 router — only address with deployed bytecode on mainnet
};

const GET_AMOUNTS_OUT_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPriceResult {
  /** How many tokenOut you get per 1 tokenIn (human-readable, e.g. "1.045") */
  swappiPrice: string | null;
  /** USD value of 1 tokenIn, or null if not indexed */
  tokenInUsd: number | null;
  /** USD value of 1 tokenOut, or null if not indexed */
  tokenOutUsd: number | null;
  loading: boolean;
  error: string | null;
  /** Timestamp of last successful price fetch */
  lastUpdated: Date | null;
  /** Force an immediate re-fetch */
  refresh: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a price number to 6 significant figures as a plain decimal string.
 * JavaScript's toPrecision() can produce scientific notation (e.g. 8.67e-12);
 * this helper always returns a readable decimal like 0.00000000000867789.
 */
function formatPriceDecimal(n: number): string {
  if (n === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  // For large numbers (magnitude >= 8) or tiny magnitudes use sig-fig approach
  const decimals = Math.max(0, 7 - magnitude); // 8 sig figs
  const fixed = n.toFixed(Math.min(decimals, 18));
  // Strip trailing zeros after decimal point but keep at least one decimal for small values
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// ─── DeFiLlama helper ─────────────────────────────────────────────────────────

async function fetchUsdPrices(
  addresses: string[],
  network: string
): Promise<Record<string, number>> {
  try {
    const chain = network === 'mainnet' ? 'conflux' : 'conflux-espace';
    const coins = addresses.map((a) => `${chain}:${a.toLowerCase()}`).join(',');
    const res = await fetch(`https://coins.llama.fi/prices/current/${coins}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      coins: Record<string, { price: number }>;
    };
    const out: Record<string, number> = {};
    for (const [key, val] of Object.entries(data.coins)) {
      const addr = key.split(':')[1];
      if (addr) out[addr.toLowerCase()] = val.price;
    }
    return out;
  } catch {
    return {};
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTokenPrice(
  tokenInAddress: string | undefined,
  tokenOutAddress: string | undefined,
  tokenInDecimals = 18,
  tokenOutDecimals = 18
): TokenPriceResult {
  const [result, setResult] = useState<Omit<TokenPriceResult, 'refresh'>>({
    swappiPrice: null,
    tokenInUsd: null,
    tokenOutUsd: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Keep decimals in a ref so the fetch function can read them without being
  // listed as an effect dependency (avoids spurious re-fetches as token metadata loads).
  const decimalsRef = useRef({ in: tokenInDecimals, out: tokenOutDecimals });
  decimalsRef.current = { in: tokenInDecimals, out: tokenOutDecimals };

  // Core fetch — never resets existing price; always merges into prev state.
  const doFetch = useCallback(
    (inAddr: string, outAddr: string, cancelled: { v: boolean }) => {
      const network = (process.env.NEXT_PUBLIC_NETWORK ?? 'testnet') as
        | 'testnet'
        | 'mainnet';
      const rpcUrl =
        network === 'testnet'
          ? 'https://evmtestnet.confluxrpc.com'
          : 'https://evm.confluxrpc.com';
      const chain =
        network === 'testnet' ? confluxESpaceTestnet : confluxESpace;
      const wcfx = wcfxAddress(network);
      const resolvedIn = getAddress(
        inAddr.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()
          ? wcfx
          : inAddr
      );
      const resolvedOut = getAddress(
        outAddr.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()
          ? wcfx
          : outAddr
      );
      const client = createPublicClient({ chain, transport: http(rpcUrl) });
      const router = SWAPPI_ROUTER[network] as Address;
      const oneTokenIn = BigInt(10) ** BigInt(decimalsRef.current.in);

      (async () => {
        const [swappiResult, usdPrices] = await Promise.allSettled([
          client.readContract({
            address: router,
            abi: GET_AMOUNTS_OUT_ABI,
            functionName: 'getAmountsOut',
            args: [oneTokenIn, [resolvedIn as Address, resolvedOut as Address]],
          }) as Promise<bigint[]>,
          fetchUsdPrices([resolvedIn, resolvedOut], network),
        ]);
        if (cancelled.v) return;

        let freshPrice: string | null = null;
        if (swappiResult.status === 'fulfilled') {
          const amounts = swappiResult.value;
          if (amounts?.length >= 2) {
            freshPrice = formatPriceDecimal(
              Number(formatUnits(amounts[1], decimalsRef.current.out))
            );
          }
        }
        const usd = usdPrices.status === 'fulfilled' ? usdPrices.value : {};

        // Always preserve existing values if new fetch didn't return better data.
        setResult((prev) => ({
          swappiPrice: freshPrice ?? prev.swappiPrice,
          tokenInUsd: usd[resolvedIn.toLowerCase()] ?? prev.tokenInUsd,
          tokenOutUsd: usd[resolvedOut.toLowerCase()] ?? prev.tokenOutUsd,
          loading: false,
          error:
            swappiResult.status === 'rejected'
              ? `No price for this pair: ${(swappiResult as PromiseRejectedResult).reason?.message ?? 'unknown'}`
              : null,
          lastUpdated: freshPrice ? new Date() : prev.lastUpdated,
        }));
      })();
    },
    []
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 1: pair changed → clear stale price, show spinner, fetch.
  useEffect(() => {
    if (!tokenInAddress || !tokenOutAddress) {
      setResult({
        swappiPrice: null,
        tokenInUsd: null,
        tokenOutUsd: null,
        loading: false,
        error: null,
        lastUpdated: null,
      });
      return;
    }
    setResult({
      swappiPrice: null,
      tokenInUsd: null,
      tokenOutUsd: null,
      loading: true,
      error: null,
      lastUpdated: null,
    });
    const cancelled = { v: false };
    doFetch(tokenInAddress, tokenOutAddress, cancelled);
    return () => {
      cancelled.v = true;
    };
  }, [tokenInAddress, tokenOutAddress, doFetch]); // intentionally excludes decimals

  // Effect 2: tick changed (background/manual refresh) → fetch WITHOUT touching existing price.
  useEffect(() => {
    if (!tokenInAddress || !tokenOutAddress || tick === 0) return;
    const cancelled = { v: false };
    doFetch(tokenInAddress, tokenOutAddress, cancelled);
    return () => {
      cancelled.v = true;
    };
  }, [tick, tokenInAddress, tokenOutAddress, doFetch]);

  // Auto-refresh every 15 s while a pair is selected.
  useEffect(() => {
    if (!tokenInAddress || !tokenOutAddress) return;
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [tokenInAddress, tokenOutAddress]);

  return { ...result, refresh };
}
