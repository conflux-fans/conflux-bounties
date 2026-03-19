'use client';

/**
 * usePoolTokens – resolves Swappi pools from the backend and enriches each
 * token with the connected user's on-chain balance.
 *
 * Resilience strategy – tokens and pairs only grow, never shrink:
 *   - Two cumulative Maps are kept in refs (knownTokensRef, knownPairsRef).
 *   - Every successful backend fetch MERGES into these maps; no entry is ever
 *     removed.  A flaky RPC response that temporarily drops some tokens cannot
 *     make them disappear from the UI.
 *   - The same merged set is written back to localStorage so the next mount
 *     starts from the full union, not just the last partial response.
 *   - Balance enrichment always works off knownTokensRef so balance updates
 *     never reduce the visible token count.
 *
 * Caching strategy:
 *   - Token metadata + pair topology → localStorage (key: cas_pool_meta_v1,
 *     TTL 10 min). Read synchronously on mount so the dropdown renders at once.
 *   - Backend /api/pools always runs in the background (stale-while-revalidate).
 *   - All balanceOf calls are batched into a single Multicall3 request (1 RPC call).
 *
 * CFX (native) handling:
 *   - Synthetic "CFX (native)" entry at CFX_NATIVE_ADDRESS (EIP-7528).
 *   - WCFX ERC-20 is renamed to "wCFX".
 *   - resolveTokenInAddress() maps the sentinel → WCFX before contract calls.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Address, createPublicClient, formatUnits, http } from 'viem';
import { confluxESpace, confluxESpaceTestnet } from 'viem/chains';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenWithBalance {
  address: string;
  symbol: string;
  name: string;
  /**
   * Token decimals — `null` when GeckoTerminal did not publish them.
   * Consumers that need an accurate value for `parseUnits` / `formatUnits`
   * should fall back to an on-chain `decimals()` read when this is null.
   * Display-only callers can safely fall back to 18.
   */
  decimals: number | null;
  /** Token logo image URL (from GeckoTerminal), if available */
  logoURI?: string;
  /** Raw wei balance as string, '0' if no wallet connected */
  balanceWei: string;
  /** Human-readable balance, e.g. '123.45' */
  balanceFormatted: string;
}

export interface PairInfo {
  address: string;
  token0: string;
  token1: string;
}

export interface UsePoolTokensResult {
  tokens: TokenWithBalance[];
  pairs: PairInfo[];
  /** True only on first-ever load when there is no cached metadata yet. */
  loading: boolean;
  /** True while on-chain balances are being fetched (background enrichment). */
  balancesLoading: boolean;
  error: string | null;
  /** Non-null when balance RPC calls partially or fully failed (quota/node issue). */
  rpcWarning: string | null;
  refresh: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CFX_NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const WCFX_ADDRESSES: Record<string, string> = {
  testnet: '0x2ED3dddae5B2F321AF0806181FBFA6D049Be47d8',
  mainnet: '0x14b2D3bC65e74DAE1030EAFd8ac30c533c976A9b', // EIP-55 checksum: last char is lowercase b
};

export function wcfxAddress(
  network = process.env.NEXT_PUBLIC_NETWORK ?? 'testnet'
): string {
  return WCFX_ADDRESSES[network] ?? WCFX_ADDRESSES.testnet;
}

export function resolveTokenInAddress(address: string): string {
  if (address.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()) {
    return wcfxAddress();
  }
  return address;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const CACHE_KEY = 'cas_pool_meta_v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface PoolMeta {
  address: string; // always lower-cased
  symbol: string;
  name: string;
  decimals: number | null;
  logoURI?: string;
}

interface PoolCache {
  tokens: PoolMeta[];
  pairs: PairInfo[];
  cachedAt: number;
}

function readCache(): PoolCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as PoolCache;
    // Normalise addresses in old cache entries that might not be lowercased
    c.tokens = c.tokens.map((t) => ({
      ...t,
      address: t.address.toLowerCase(),
    }));
    c.pairs = c.pairs.map((p) => ({
      ...p,
      address: p.address.toLowerCase(),
      token0: p.token0.toLowerCase(),
      token1: p.token1.toLowerCase(),
    }));
    if (Date.now() - c.cachedAt > CACHE_TTL) return null;
    return c;
  } catch {
    return null;
  }
}

/** Read cache without TTL check – used as merge base even when stale. */
function readCacheIgnoreTTL(): PoolCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as PoolCache;
    c.tokens = c.tokens.map((t) => ({
      ...t,
      address: t.address.toLowerCase(),
    }));
    c.pairs = c.pairs.map((p) => ({
      ...p,
      address: p.address.toLowerCase(),
      token0: p.token0.toLowerCase(),
      token1: p.token1.toLowerCase(),
    }));
    return c;
  } catch {
    return null;
  }
}

function writeCache(tokens: PoolMeta[], pairs: PairInfo[]): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        tokens,
        pairs,
        cachedAt: Date.now(),
      } satisfies PoolCache)
    );
  } catch {
    // Storage quota exceeded or private-browsing mode — silently skip
  }
}

// ─── Union helpers ────────────────────────────────────────────────────────────

/**
 * Merge fresh token metadata into the cumulative known-tokens map.
 * Existing entries are only overwritten if the fresh data has the same address
 * (metadata update e.g. decimals correction), but entries are never removed.
 */
function mergeTokens(known: Map<string, PoolMeta>, fresh: PoolMeta[]): void {
  for (const t of fresh) {
    known.set(t.address.toLowerCase(), {
      ...t,
      address: t.address.toLowerCase(),
    });
  }
}

/**
 * Merge fresh pair info into the cumulative known-pairs map.
 * Key is sorted(token0, token1) so pair direction doesn't matter.
 */
function mergePairs(known: Map<string, PairInfo>, fresh: PairInfo[]): void {
  for (const p of fresh) {
    const t0 = p.token0.toLowerCase();
    const t1 = p.token1.toLowerCase();
    const key = [t0, t1].sort().join('|');
    known.set(key, {
      address: p.address.toLowerCase(),
      token0: t0,
      token1: t1,
    });
  }
}

// ─── ABI ─────────────────────────────────────────────────────────────────────

const BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Returns tokens that are paired with tokenInAddress.
 * All address comparisons are case-insensitive.
 */
export function getPairedTokens(
  pairs: PairInfo[],
  allTokens: TokenWithBalance[],
  tokenInAddress: string
): TokenWithBalance[] {
  if (!tokenInAddress) return allTokens;

  const incoming = tokenInAddress.toLowerCase();
  const wcfx = wcfxAddress().toLowerCase();
  const cfxNative = CFX_NATIVE_ADDRESS.toLowerCase();

  // Resolve CFX native → wCFX for pair lookups
  const resolved = incoming === cfxNative ? wcfx : incoming;

  // Build counterpart set (lowercased)
  const counterparts = new Set<string>();
  for (const p of pairs) {
    const t0 = p.token0.toLowerCase();
    const t1 = p.token1.toLowerCase();
    if (t0 === resolved) counterparts.add(t1);
    if (t1 === resolved) counterparts.add(t0);
  }

  // Replace wCFX with CFX native so users always see "CFX" not "wCFX",
  // unless the user IS selling CFX (then don't show CFX again on the other side).
  const wCfxPaired = counterparts.has(wcfx);
  counterparts.delete(wcfx);
  counterparts.delete(cfxNative); // always work from deduplicated ERC-20 set

  const results = allTokens.filter(
    (t) =>
      counterparts.has(t.address.toLowerCase()) &&
      t.address.toLowerCase() !== cfxNative &&
      t.address.toLowerCase() !== wcfx
  );

  // Inject CFX native at the top when wCFX was a counterpart and tokenIn is NOT CFX
  if (wCfxPaired && incoming !== cfxNative) {
    const cfxEntry = allTokens.find(
      (t) => t.address.toLowerCase() === cfxNative
    );
    if (cfxEntry) return [cfxEntry, ...results];
  }

  return results;
}

/** Build a zero-balance token list from raw metadata. */
function metaToTokens(rawTokens: PoolMeta[]): TokenWithBalance[] {
  const wcfx = wcfxAddress().toLowerCase();
  return rawTokens.map((t) => ({
    ...t,
    address: t.address.toLowerCase(),
    symbol: t.address.toLowerCase() === wcfx ? 'wCFX' : t.symbol,
    name: t.address.toLowerCase() === wcfx ? 'Wrapped CFX' : t.name,
    logoURI: t.logoURI,
    balanceWei: '0',
    balanceFormatted: '0',
  }));
}

const CFX_ENTRY_ZERO: TokenWithBalance = {
  address: CFX_NATIVE_ADDRESS,
  symbol: 'CFX',
  name: 'Conflux (native)',
  decimals: 18,
  balanceWei: '0',
  balanceFormatted: '0',
};

/**
 * Build the CFX (native) token entry, borrowing wCFX's logoURI so the icon
 * shows in the selector even though CFX is a synthetic (EIP-7528) entry.
 */
function cfxEntryFrom(knownTokens: Map<string, PoolMeta>): TokenWithBalance {
  const wcfx = wcfxAddress().toLowerCase();
  const logo = knownTokens.get(wcfx)?.logoURI;
  return logo ? { ...CFX_ENTRY_ZERO, logoURI: logo } : CFX_ENTRY_ZERO;
}

/** Wrap a promise with a timeout.
 * - Resolves to `null` on timeout/network error (distinguishable from a real 0).
 * - `silent` skips the console.warn — use only for expected failures (e.g.
 *   multicall balanceOf on non-ERC20 contracts, handled via allowFailure). */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  silent = false
): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      if (!silent)
        console.warn('[usePoolTokens] RPC call timed out after', ms, 'ms');
      resolve(null);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        if (!silent) {
          const msg: string = err?.message ?? String(err);
          console.warn('[usePoolTokens] RPC call rejected:', msg);
        }
        resolve(null);
      }
    );
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePoolTokens(
  userAddress: string | undefined
): UsePoolTokensResult {
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcWarning, setRpcWarning] = useState<string | null>(null);
  const [_tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Auto-refresh balances every 30 s while a wallet is connected
  useEffect(() => {
    if (!userAddress) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [userAddress]);

  // ── Cumulative union state ─────────────────────────────────────────────────
  // These maps only grow; entries are never removed.
  const knownTokensRef = useRef<Map<string, PoolMeta>>(new Map());
  const knownPairsRef = useRef<Map<string, PairInfo>>(new Map());

  /** Snapshot the current union maps into React state. */
  const applyKnown = useCallback(() => {
    const tokenArr = Array.from(knownTokensRef.current.values());
    const pairArr = Array.from(knownPairsRef.current.values());
    setPairs(pairArr);
    return { tokenArr, pairArr };
  }, []);

  // ── Phase 2: enrich with on-chain balances ─────────────────────────────────
  const fetchBalances = useCallback(
    async (owner: string, signal: AbortSignal) => {
      // Always work off the FULL known set, not just whatever the last fetch returned.
      // Exclude pair LP addresses — they live in knownPairs, not tokens, but
      // occasionally leak in; they have no balanceOf and would spam RPC errors.
      const pairAddrs = new Set(
        Array.from(knownPairsRef.current.values()).map((p) =>
          p.address.toLowerCase()
        )
      );
      const rawTokens = Array.from(knownTokensRef.current.values()).filter(
        (t) => !pairAddrs.has(t.address.toLowerCase())
      );

      setBalancesLoading(true);
      try {
        const network = (process.env.NEXT_PUBLIC_NETWORK ?? 'testnet') as
          | 'testnet'
          | 'mainnet';
        const rpcUrl =
          network === 'testnet'
            ? 'https://evmtestnet.confluxrpc.com'
            : 'https://evm.confluxrpc.com';
        const chain =
          network === 'testnet' ? confluxESpaceTestnet : confluxESpace;
        const client = createPublicClient({ chain, transport: http(rpcUrl) });

        const CALL_TIMEOUT = 30_000;

        console.log('[usePoolTokens] fetchBalances start', {
          owner,
          network,
          rpcUrl,
          ercTokenCount: rawTokens.length,
        });

        // ── Fetch native CFX balance (always, even if no ERC-20 tokens) ──
        // Not run through multicall — it's a plain eth_getBalance request.
        const nativeResult = await withTimeout(
          client.getBalance({ address: owner as Address }),
          CALL_TIMEOUT
        );
        if (signal.aborted) return;
        console.log(
          '[usePoolTokens] fetchBalances nativeResult:',
          nativeResult?.toString() ?? 'null (failed)'
        );

        // ── Fetch ERC-20 balances via Multicall3 (skip if no tokens yet) ─
        const MULTICALL3 =
          '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
        let ercResults: (bigint | null)[] = [];
        let multicallResult: Awaited<
          ReturnType<typeof client.multicall>
        > | null = null;

        if (rawTokens.length > 0) {
          // Pass `silent: true` — per-token failures inside multicall are expected
          // (allowFailure:true handles them), so we don't want noise per token.
          multicallResult = await withTimeout(
            client.multicall({
              contracts: rawTokens.map((t) => ({
                address: t.address as Address,
                abi: BALANCE_OF_ABI,
                functionName: 'balanceOf' as const,
                args: [owner as Address],
              })),
              allowFailure: true,
              multicallAddress: MULTICALL3,
            }),
            CALL_TIMEOUT,
            /* silent */ true
          );
          ercResults = multicallResult
            ? (multicallResult as { status: string; result: unknown }[]).map(
                (r) => (r.status === 'success' ? (r.result as bigint) : null)
              )
            : rawTokens.map(() => null);
          const successCount = ercResults.filter((r) => r !== null).length;
          console.log(
            `[usePoolTokens] fetchBalances multicall: ${successCount}/${rawTokens.length} succeeded, full timeout: ${multicallResult === null}`
          );
        }
        if (signal.aborted) return;

        // Show warning banner only for hard failures (full timeout), not per-token
        // allowFailure rejections which are expected for non-ERC20 addresses.
        if (nativeResult === null) {
          const msg = 'CFX balance fetch failed — RPC may be unavailable.';
          console.warn('[usePoolTokens] fetchBalances:', msg);
          setRpcWarning(msg);
        } else if (rawTokens.length > 0 && multicallResult === null) {
          const msg =
            'Token balance fetch timed out — RPC may be overloaded. Showing last known balances.';
          console.warn('[usePoolTokens] fetchBalances:', msg);
          setRpcWarning(msg);
        } else {
          setRpcWarning(null);
        }

        const wcfx = wcfxAddress().toLowerCase();
        const enriched: TokenWithBalance[] = rawTokens.map((t, i) => {
          const raw = ercResults[i];
          return {
            ...t,
            symbol: t.address.toLowerCase() === wcfx ? 'wCFX' : t.symbol,
            name: t.address.toLowerCase() === wcfx ? 'Wrapped CFX' : t.name,
            // null means the call timed out — balanceWei stays '0' for now;
            // the merge step below reinstates any previously-known balance.
            balanceWei: raw !== null ? raw.toString() : '0',
            balanceFormatted:
              raw !== null ? formatUnits(raw, t.decimals ?? 18) : '0',
          };
        });

        enriched.sort((a, b) => {
          const diff = BigInt(b.balanceWei) - BigInt(a.balanceWei);
          return diff > 0n
            ? 1
            : diff < 0n
              ? -1
              : a.symbol.localeCompare(b.symbol);
        });

        const nativeBal = nativeResult ?? 0n;
        const cfxWithBalance: TokenWithBalance = {
          ...cfxEntryFrom(knownTokensRef.current),
          balanceWei: nativeBal.toString(),
          balanceFormatted: formatUnits(nativeBal, 18),
        };

        if (!signal.aborted) {
          // Merge: if a call timed out (null) and we had a previous non-zero
          // balance for that token, keep it — prevents the wallet-filtered
          // Token In list from shrinking due to intermittent RPC failures.
          setTokens((prev) => {
            const prevMap = new Map(
              prev.map((t) => [t.address.toLowerCase(), t.balanceWei])
            );
            const timedOut = ercResults.map((r) => r === null);
            const merged = [
              // CFX: keep previous balance if native call timed out
              nativeResult !== null
                ? cfxWithBalance
                : (prev.find((t) => t.address === CFX_NATIVE_ADDRESS) ??
                  cfxWithBalance),
              ...enriched.map((t, i) => {
                if (timedOut[i]) {
                  const prevBal = prevMap.get(t.address.toLowerCase()) ?? '0';
                  if (prevBal !== '0') {
                    return {
                      ...t,
                      balanceWei: prevBal,
                      balanceFormatted: formatUnits(
                        BigInt(prevBal),
                        t.decimals ?? 18
                      ),
                    };
                  }
                }
                return t;
              }),
            ];
            const [cfxEntry, ...rest] = merged;
            rest.sort((a, b) => {
              const diff = BigInt(b.balanceWei) - BigInt(a.balanceWei);
              return diff > 0n
                ? 1
                : diff < 0n
                  ? -1
                  : a.symbol.localeCompare(b.symbol);
            });
            return [cfxEntry, ...rest];
          });
        }
      } catch (err: unknown) {
        console.error(
          '[usePoolTokens] fetchBalances threw:',
          (err as Error)?.message ?? err
        );
        setRpcWarning('Balance fetch failed — see browser console for details');
        // balance fetch errors are non-fatal; existing list stays visible
      } finally {
        if (!signal.aborted) setBalancesLoading(false);
      }
    },
    []
  );

  // ── Tick-watcher: re-fetch on-chain balances on every refresh() / 30s tick ─
  // The main Phase-1 effect already fetches balances on first mount via
  // fetchBalances(userAddress, signal).  This separate effect runs on every
  // subsequent tick so manual refresh calls and the 30 s interval actually work.
  const tickMountedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: _tick is intentionally a trigger-only dep, not referenced inside the effect body
  useEffect(() => {
    // Skip tick=0 (initial mount) — Phase 1 handles the first fetch.
    if (!tickMountedRef.current) {
      tickMountedRef.current = true;
      return;
    }
    if (!userAddress) return;
    const ctrl = new AbortController();
    void fetchBalances(userAddress, ctrl.signal);
    return () => ctrl.abort();
  }, [_tick, userAddress, fetchBalances]);

  // ── Phase 1: metadata (cache-first → background refresh) ──────────────────
  useEffect(() => {
    const abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    // ── Seed known maps from localStorage (TTL-ignored so we always have a base)
    const persisted = readCacheIgnoreTTL();
    if (persisted) {
      mergeTokens(knownTokensRef.current, persisted.tokens);
      mergePairs(knownPairsRef.current, persisted.pairs);
    }

    // Step A: paint from valid cache immediately
    const cached = readCache(); // TTL-checked
    if (cached) {
      const { tokenArr } = applyKnown();
      // Use a functional update so we never clobber real balances that are
      // already in state (e.g. on a background tick refresh).  If prev is
      // already populated we merge — same pattern as Step B — so the balance
      // column stays stable and doesn't flash to 0 while Step B's
      // fetchBalances is in flight.
      const cfxBase = cfxEntryFrom(knownTokensRef.current);
      const freshMeta = metaToTokens(tokenArr);
      setTokens((prev) => {
        if (prev.length === 0) {
          return [cfxBase, ...freshMeta];
        }
        const existing = new Map(prev.map((t) => [t.address.toLowerCase(), t]));
        const prevCfx = existing.get(CFX_NATIVE_ADDRESS.toLowerCase());
        const cfxEntry = prevCfx
          ? {
              ...cfxBase,
              balanceWei: prevCfx.balanceWei,
              balanceFormatted: prevCfx.balanceFormatted,
            }
          : cfxBase;
        const rest = freshMeta.map(
          (t) => existing.get(t.address.toLowerCase()) ?? t
        );
        rest.sort((a, b) => {
          const diff = BigInt(b.balanceWei) - BigInt(a.balanceWei);
          return diff > 0n
            ? 1
            : diff < 0n
              ? -1
              : a.symbol.localeCompare(b.symbol);
        });
        return [cfxEntry, ...rest];
      });
      setLoading(false);
      if (userAddress) {
        fetchBalances(userAddress, signal);
      }
    }
    // Step B: always re-fetch from backend (stale-while-revalidate)
    (async () => {
      try {
        const res = await fetch('/api/pools', { signal });
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        const data = (await res.json()) as {
          tokens: PoolMeta[];
          pairs: PairInfo[];
        };

        if (signal.aborted) return;

        // Merge fresh data into the cumulative union — never shrink
        mergeTokens(knownTokensRef.current, data.tokens);
        mergePairs(knownPairsRef.current, data.pairs);

        const mergedTokens = Array.from(knownTokensRef.current.values());
        const mergedPairs = Array.from(knownPairsRef.current.values());

        // Persist the merged union (not just the fresh slice) to localStorage
        writeCache(mergedTokens, mergedPairs);

        // Update pairs in state
        setPairs(mergedPairs);

        // Show tokens right after the backend responds.  Use a functional
        // update so we don't clobber balances that Step-A's fetchBalances may
        // have already filled in (warm-start case).
        //  - Cold start (prev=[]):  initialise with zero-balance metadata so
        //    the token selectors appear immediately.
        //  - Warm start (prev has enriched balances):  union-in any newly-seen
        //    tokens but preserve existing balances — avoids flash-to-zero.
        const freshMeta = metaToTokens(mergedTokens);
        // Capture logo-aware CFX entry now (knownTokensRef has wCFX logo after merge)
        const cfxBase = cfxEntryFrom(knownTokensRef.current);
        setTokens((prev) => {
          if (prev.length === 0) {
            return [cfxBase, ...freshMeta];
          }
          const existing = new Map(
            prev.map((t) => [t.address.toLowerCase(), t])
          );
          // Preserve existing balance but ensure logo is populated
          const prevCfx = existing.get(CFX_NATIVE_ADDRESS.toLowerCase());
          const cfxEntry = prevCfx
            ? {
                ...cfxBase,
                balanceWei: prevCfx.balanceWei,
                balanceFormatted: prevCfx.balanceFormatted,
              }
            : cfxBase;
          const rest = freshMeta.map(
            (t) => existing.get(t.address.toLowerCase()) ?? t
          );
          rest.sort((a, b) => {
            const diff = BigInt(b.balanceWei) - BigInt(a.balanceWei);
            return diff > 0n
              ? 1
              : diff < 0n
                ? -1
                : a.symbol.localeCompare(b.symbol);
          });
          return [cfxEntry, ...rest];
        });
        setLoading(false);

        if (!userAddress) return;

        // Re-run balance enrichment over the full merged set.  On warm start
        // this is a refresh; on cold start this is the first enrichment.
        await fetchBalances(userAddress, signal);
      } catch (err: unknown) {
        if (signal.aborted) return;
        const msg = (err as Error)?.message ?? String(err);
        console.warn('[usePoolTokens] /api/pools fetch failed:', msg);
        if (cached || persisted) {
          // Degraded mode: we already have data on screen, just clear the spinner
          setLoading(false);
        } else {
          setError(msg);
          setLoading(false);
        }
      }
    })();

    return () => abortCtrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, applyKnown, fetchBalances]);

  return {
    tokens,
    pairs,
    loading,
    balancesLoading,
    error,
    rpcWarning,
    refresh,
  };
}
