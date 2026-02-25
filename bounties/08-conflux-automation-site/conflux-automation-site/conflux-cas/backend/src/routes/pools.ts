/**
 * GET /pools
 *
 * Returns all Swappi token pairs and token metadata resolved entirely on-chain
 * via Multicall3. No third-party API is used. Response is cached for 30 minutes
 * (configurable via POOLS_CACHE_TTL_MS env var).
 *
 * Clients can call GET /pools without authentication.
 * The frontend hook then enriches the list with per-wallet balanceOf calls.
 */
import { Router, type Router as RouterType } from 'express';
import {
  type Address,
  createPublicClient,
  http,
  type PublicClient,
} from 'viem';
import { confluxESpaceTestnet } from 'viem/chains';

// ─── ABIs (minimal) ───────────────────────────────────────────────────────────

const ROUTER_ABI = [
  {
    name: 'factory',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const FACTORY_ABI = [
  {
    name: 'allPairsLength',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allPairs',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const PAIR_ABI = [
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const SWAPPI_ROUTER: Record<'testnet' | 'mainnet', Address> = {
  testnet: '0x873789aaf553fd0b4252d0d2b72c6331c47aff2e',
  mainnet: '0xE37B52296b0bAA91412cD0Cd97975B0805037B84', // Swappi v2 router — only address with deployed bytecode on mainnet
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  /**
   * Token decimals from GeckoTerminal metadata, or from the on-chain ERC-20
   * `decimals()` call (testnet path).  May be `null` when GeckoTerminal does
   * not publish decimals for a token — the frontend will verify on-chain.
   */
  decimals: number | null;
  logoURI?: string;
}

export interface PairInfo {
  address: string;
  token0: string; // lower-cased
  token1: string; // lower-cased
}

export interface PoolsResponse {
  tokens: TokenInfo[];
  pairs: PairInfo[];
  cachedAt: number;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = Number(process.env.POOLS_CACHE_TTL_MS ?? 30 * 60 * 1000);

/** TTL-guarded cache — expires and triggers a re-fetch. */
let _cache: { data: PoolsResponse; fetchedAt: number } | null = null;

/**
 * In-flight deduplication: if a fetchPools() is already running, share it
 * rather than starting a second simultaneous chain (thundering-herd guard).
 */
let _inflight: Promise<PoolsResponse> | null = null;

/**
 * Permanent accumulative maps — tokens and pairs only grow, never shrink.
 * If a background refresh partially fails (some RPC calls time out), the
 * tokens that were seen in previous fetches are never removed from responses.
 */
const _permanentTokens = new Map<string, TokenInfo>(); // key: lc address
const _permanentPairs = new Map<string, PairInfo>(); // key: sorted lc addrs

function mergeIntoPermanent(tokens: TokenInfo[], pairs: PairInfo[]): void {
  for (const t of tokens) {
    _permanentTokens.set(t.address.toLowerCase(), {
      ...t,
      address: t.address.toLowerCase(),
    });
  }
  for (const p of pairs) {
    const t0 = p.token0.toLowerCase();
    const t1 = p.token1.toLowerCase();
    const key = [t0, t1].sort().join('|');
    _permanentPairs.set(key, {
      address: p.address.toLowerCase(),
      token0: t0,
      token1: t1,
    });
  }
}

function buildPermanentResponse(): PoolsResponse {
  const tokens = Array.from(_permanentTokens.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );
  const validAddrs = new Set(tokens.map((t) => t.address));
  const pairs = Array.from(_permanentPairs.values()).filter(
    (p) => validAddrs.has(p.token0) && validAddrs.has(p.token1)
  );
  return { tokens, pairs, cachedAt: Date.now() };
}

// ─── Rate-limit helpers ──────────────────────────────────────────────────────

// All four knobs are tunable via env vars — useful on rate-limited testnets.
const CALLS_PER_CHUNK = Number(process.env.POOLS_CHUNK_SIZE ?? 10); // calls per sequential chunk (= 1 HTTP batch)
const CHUNK_DELAY_MS = Number(process.env.POOLS_CHUNK_DELAY_MS ?? 150); // ms pause between chunks
const BATCH_SIZE = Number(process.env.POOLS_BATCH_SIZE ?? 20); // viem batchSize per HTTP request
const BATCH_WAIT_MS = Number(process.env.POOLS_BATCH_WAIT_MS ?? 16); // viem batch coalescing window

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Like Promise.allSettled but processes `thunks` CALLS_PER_CHUNK at a time,
 * waiting CHUNK_DELAY_MS between groups. This keeps concurrent in-flight
 * HTTP requests to a minimum, preventing "Request exceeds defined limit".
 */
async function chunkedSettled<T>(
  thunks: Array<() => Promise<T>>,
  label = 'rpc'
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < thunks.length; i += CALLS_PER_CHUNK) {
    const chunkIndex = Math.floor(i / CALLS_PER_CHUNK) + 1;
    const chunk = thunks.slice(i, i + CALLS_PER_CHUNK);
    const settled = await Promise.allSettled(chunk.map((fn) => fn()));
    results.push(...settled);
    const rejected = settled.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
    if (rejected.length > 0) {
      const firstReason =
        rejected[0].reason instanceof Error
          ? rejected[0].reason.message
          : String(rejected[0].reason);
      console.warn(
        `[pools] ${label} chunk ${chunkIndex}: ${rejected.length}/${settled.length} failed — ${firstReason}`
      );
    }
    if (i + CALLS_PER_CHUNK < thunks.length) await sleep(CHUNK_DELAY_MS);
  }
  return results;
}

// ─── GeckoTerminal fetch (mainnet) ───────────────────────────────────────────
//
// Uses the free GeckoTerminal public API — no API key required.
// Docs: https://api.geckoterminal.com/api/v2
//
// Strategy:
//   1. Page through /networks/cfx/dexes/swappi/pools (20 per page, max 10 pages)
//   2. Collect unique token addresses from pool relationships
//   3. Batch-fetch token metadata from /networks/cfx/tokens/multi (30 per batch)
//   4. Build PoolsResponse in the same shape as the on-chain path

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';
const GECKO_HEADERS: Record<string, string> = {
  Accept: 'application/json;version=20230302',
  'User-Agent': 'conflux-cas-backend/1.0',
};

interface GeckoPool {
  id: string;
  attributes: { address: string; name: string; reserve_in_usd: string };
  relationships: {
    base_token: { data: { id: string } };
    quote_token: { data: { id: string } };
  };
}

async function fetchPoolsFromGecko(): Promise<PoolsResponse> {
  // Paginate through Swappi pools with token data included in each response.
  // ?include=base_token,quote_token adds an `included` array with full token
  // attributes (symbol, name, decimals) — no separate token API call needed.
  const tokenMap = new Map<string, TokenInfo>();
  const rawPools: Array<{ pairAddr: string; t0: string; t1: string }> = [];
  const MAX_PAGES = 10;
  const PAGE_DELAY_MS = 1_200; // GeckoTerminal free tier: ~1 req/s sustained

  /** Fetch one URL with up to maxRetries retries on HTTP 429. */
  async function fetchPage(
    page: number,
    maxRetries = 4
  ): Promise<{
    data: GeckoPool[];
    included?: Array<{
      type: string;
      attributes: {
        address: string;
        symbol: string;
        name: string;
        decimals: number | null;
        image_url?: string | null;
      };
    }>;
  } | null> {
    const url = `${GECKO_BASE}/networks/cfx/dexes/swappi/pools?page=${page}&include=base_token%2Cquote_token`;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        headers: GECKO_HEADERS,
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return res.json() as ReturnType<typeof fetchPage>;
      if (res.status === 429) {
        const retryAfterSec = Number(res.headers.get('retry-after') ?? 0);
        const wait =
          retryAfterSec > 0 ? retryAfterSec * 1_000 : 2_500 * attempt;
        console.warn(
          `[pools/gecko] page ${page} rate-limited (attempt ${attempt}/${maxRetries}) — waiting ${wait}ms`
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.warn(`[pools/gecko] page ${page} HTTP ${res.status}`);
      return null;
    }
    console.warn(
      `[pools/gecko] page ${page} gave up after ${maxRetries} retries`
    );
    return null;
  }

  for (let page = 1; page <= MAX_PAGES; page++) {
    const json = await fetchPage(page);
    if (!json) break;

    const page_data = json.data ?? [];
    if (page_data.length === 0) break;
    // Skip tokens with GeckoTerminal placeholder symbols like '[invalid]'.
    for (const item of json.included ?? []) {
      if (item.type !== 'token') continue;
      const addr = item.attributes.address.toLowerCase();
      const symbol = item.attributes.symbol?.trim() ?? '';
      const name = item.attributes.name?.trim() ?? '';
      // Keep decimals as null when GeckoTerminal doesn't publish them.
      // The TokenInfo.decimals type is `number | null`; the frontend
      // StrategyBuilder will call the ERC-20 `decimals()` on-chain when null.
      const decimals =
        item.attributes.decimals != null
          ? Number(item.attributes.decimals)
          : null;
      const logoURI = item.attributes.image_url ?? undefined;
      // Filter: skip tokens with empty/placeholder symbols or no decimals info
      if (!symbol || !name || symbol.startsWith('[') || symbol.endsWith(']'))
        continue;
      if (!tokenMap.has(addr)) {
        tokenMap.set(addr, { address: addr, symbol, name, decimals, logoURI });
      } else if (logoURI && !tokenMap.get(addr)?.logoURI) {
        // Backfill logoURI if the token was already registered without one
        tokenMap.get(addr)!.logoURI = logoURI;
      }
    }

    // Extract pool → pair mapping
    for (const pool of page_data) {
      const addr = pool.attributes.address.toLowerCase();
      const t0 = pool.relationships.base_token.data.id
        .replace(/^cfx_/, '')
        .toLowerCase();
      const t1 = pool.relationships.quote_token.data.id
        .replace(/^cfx_/, '')
        .toLowerCase();
      rawPools.push({ pairAddr: addr, t0, t1 });
    }

    console.log(
      `[pools/gecko] page ${page}: ${page_data.length} pools, ${tokenMap.size} tokens so far`
    );
    if (page_data.length < 20) break; // last page
    if (page < MAX_PAGES)
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }

  // Build final pairs list — only keep pairs where both tokens resolved
  const pairs: PairInfo[] = [];
  for (const { pairAddr, t0, t1 } of rawPools) {
    if (tokenMap.has(t0) && tokenMap.has(t1)) {
      pairs.push({ address: pairAddr, token0: t0, token1: t1 });
    }
  }

  const tokens = Array.from(tokenMap.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );
  console.log(
    `[pools/gecko] resolved ${tokens.length} tokens, ${pairs.length} pairs from ${rawPools.length} pools`
  );

  return { tokens, pairs, cachedAt: Date.now() };
}

// ─── On-chain fetch (testnet) ─────────────────────────────────────────────────
//
// Full factory scan via RPC. Testnet has <100 pairs so this stays fast.

async function fetchPools(
  client: PublicClient,
  routerAddress: Address
): Promise<PoolsResponse> {
  // 1. Get factory address from router
  const factoryAddress = (await client.readContract({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'factory',
  })) as Address;

  // 2. Get total number of pairs
  const pairCount = (await client.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'allPairsLength',
  })) as bigint;

  const n = Number(pairCount);
  if (n === 0) return { tokens: [], pairs: [], cachedAt: Date.now() };

  // 3. Sequentially-chunked fetch of all pair addresses
  const pairSettled = await chunkedSettled<Address>(
    Array.from(
      { length: n },
      (_, i) => () =>
        client.readContract({
          address: factoryAddress,
          abi: FACTORY_ABI,
          functionName: 'allPairs',
          args: [BigInt(i)],
        }) as Promise<Address>
    ),
    'allPairs'
  );

  const pairAddresses: Address[] = pairSettled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((a): a is Address => a !== null);

  // 4. token0 + token1 for every pair
  const tokenSettled = await chunkedSettled<Address>(
    pairAddresses.flatMap((pair) => [
      () =>
        client.readContract({
          address: pair,
          abi: PAIR_ABI,
          functionName: 'token0',
        }) as Promise<Address>,
      () =>
        client.readContract({
          address: pair,
          abi: PAIR_ABI,
          functionName: 'token1',
        }) as Promise<Address>,
    ]),
    'token0/token1'
  );

  const tokenResults = tokenSettled.map((r) =>
    r.status === 'fulfilled'
      ? { status: 'success' as const, result: r.value }
      : {
          status: 'failure' as const,
          error: (r as PromiseRejectedResult).reason,
        }
  );

  const pairs: PairInfo[] = [];
  const uniqueTokens = new Set<string>();

  for (let i = 0; i < pairAddresses.length; i++) {
    const t0Res = tokenResults[i * 2];
    const t1Res = tokenResults[i * 2 + 1];
    if (t0Res.status !== 'success' || t1Res.status !== 'success') continue;
    const t0 = (t0Res.result as Address).toLowerCase();
    const t1 = (t1Res.result as Address).toLowerCase();
    pairs.push({
      address: pairAddresses[i].toLowerCase(),
      token0: t0,
      token1: t1,
    });
    uniqueTokens.add(t0);
    uniqueTokens.add(t1);
  }

  const tokenList = Array.from(uniqueTokens);

  // 5. symbol + name + decimals for each unique token
  const metaSettled = await chunkedSettled(
    tokenList.flatMap((addr) => [
      () =>
        client.readContract({
          address: addr as Address,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }) as Promise<unknown>,
      () =>
        client.readContract({
          address: addr as Address,
          abi: ERC20_ABI,
          functionName: 'name',
        }) as Promise<unknown>,
      () =>
        client.readContract({
          address: addr as Address,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }) as Promise<unknown>,
    ]),
    'metadata'
  );

  const metaResults = metaSettled.map((r) =>
    r.status === 'fulfilled'
      ? { status: 'success' as const, result: r.value }
      : {
          status: 'failure' as const,
          error: (r as PromiseRejectedResult).reason,
        }
  );

  const tokens: TokenInfo[] = tokenList
    .map((addr, i) => {
      const symRes = metaResults[i * 3];
      const nameRes = metaResults[i * 3 + 1];
      const decRes = metaResults[i * 3 + 2];
      if (
        symRes.status !== 'success' ||
        nameRes.status !== 'success' ||
        decRes.status !== 'success'
      )
        return null;
      const symbol = String(symRes.result).trim();
      const name = String(nameRes.result).trim();
      if (!symbol || !name) return null;
      // On-chain path always reads real decimals — cast is safe.
      return {
        address: addr,
        symbol,
        name,
        decimals: Number(decRes.result),
      } as TokenInfo;
    })
    .filter(Boolean) as TokenInfo[];

  const validAddrs = new Set(tokens.map((t) => t.address));
  const validPairs = pairs.filter(
    (p) => validAddrs.has(p.token0) && validAddrs.has(p.token1)
  );
  tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { tokens, pairs: validPairs, cachedAt: Date.now() };
}

// ─── Route ────────────────────────────────────────────────────────────────────

const router: RouterType = Router();

router.get('/', async (_req, res) => {
  // Serve from TTL-guarded cache if still fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return res.json(_cache.data);
  }

  const network = (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

  // Choose fetch strategy:
  //  • mainnet → GeckoTerminal public API (fast, no RPC flooding)
  //  • testnet → on-chain factory scan (testnet has few pairs)
  const startMs = Date.now();
  try {
    if (!_inflight) {
      if (network === 'mainnet') {
        _inflight = fetchPoolsFromGecko().finally(() => {
          _inflight = null;
        });
      } else {
        const rpcUrl =
          process.env.CONFLUX_ESPACE_TESTNET_RPC ??
          'https://evmtestnet.confluxrpc.com';
        const client = createPublicClient({
          chain: confluxESpaceTestnet,
          transport: http(rpcUrl, {
            batch: { wait: BATCH_WAIT_MS, batchSize: BATCH_SIZE },
          }),
        });
        _inflight = fetchPools(
          client as PublicClient,
          SWAPPI_ROUTER.testnet
        ).finally(() => {
          _inflight = null;
        });
      }
    }

    const fresh = await _inflight;
    console.log(
      `[pools] fetched ${fresh.tokens.length} tokens, ${fresh.pairs.length} pairs in ${Date.now() - startMs}ms`
    );

    mergeIntoPermanent(fresh.tokens, fresh.pairs);
    const merged = buildPermanentResponse();
    _cache = { data: merged, fetchedAt: Date.now() };
    return res.json(merged);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pools] fetch FAILED (${Date.now() - startMs}ms):`, message);

    if (_permanentTokens.size > 0) {
      console.warn(
        `[pools] returning ${_permanentTokens.size} cached tokens as fallback`
      );
      return res.json(buildPermanentResponse());
    }
    return res.status(502).json({ error: `Failed to fetch pools: ${message}` });
  }
});

// Manual cache invalidation endpoint (admin use)
router.post('/refresh', (_req, res) => {
  _cache = null;
  _permanentTokens.clear();
  _permanentPairs.clear();
  return res.json({
    ok: true,
    message: 'Pool cache cleared (TTL + permanent) – next GET will refetch',
  });
});

export default router;
