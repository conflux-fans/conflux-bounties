/** Conflux eSpace mainnet chain ID */
export const CHAIN_ID = 1030;

/** Default public RPC endpoint for Conflux eSpace */
export const DEFAULT_RPC_URL = 'https://evm.confluxrpc.com';

/** ERC-20 Transfer event signature: Transfer(address,address,uint256) */
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Zero address used in mint/burn detection */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Maximum reorg depth we handle before alerting */
export const MAX_REORG_DEPTH = 20;

/** Number of blocks per backfill chunk */
export const BACKFILL_CHUNK_SIZE = 10;

/** Default ingestor concurrency (parallel workers) */
export const DEFAULT_CONCURRENCY = 5;

/** Default RPC rate limit (requests per second) */
export const DEFAULT_RATE_LIMIT = 50;

/** Default poll interval for live tail (ms) */
export const DEFAULT_POLL_INTERVAL_MS = 1000;

/** Default aggregator interval (ms) — 10 minutes */
export const DEFAULT_AGGREGATOR_INTERVAL_MS = 600_000;

/** Redis cache TTLs in seconds */
export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 600,
} as const;

/** API rate limits (requests per minute) */
export const RATE_LIMITS = {
  PUBLIC: 30,
  AUTHED: 100,
} as const;

/** BullMQ queue names */
export const QUEUE_NAMES = {
  BLOCK_PROCESSOR: 'block-processor',
  AGGREGATOR: 'aggregator',
} as const;

/** Redis key prefixes */
export const REDIS_KEYS = {
  CACHE_PREFIX: 'cache:',
  INVALIDATION_CHANNEL: 'cache:invalidate',
} as const;
