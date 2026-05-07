import { z } from 'zod';

/** Hex-encoded string (0x-prefixed) */
export const HexString = z.string().regex(/^0x[0-9a-fA-F]*$/, 'Invalid hex string');

/** EVM address (0x-prefixed, 40 hex chars) */
export const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid address');

/** Transaction hash (0x-prefixed, 64 hex chars) */
export const TxHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid transaction hash');

/** Block hash (0x-prefixed, 64 hex chars) */
export const BlockHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid block hash');

export type HexString = z.infer<typeof HexString>;
export type Address = z.infer<typeof Address>;
export type TxHash = z.infer<typeof TxHash>;
export type BlockHash = z.infer<typeof BlockHash>;

/** Block as stored in the database */
export const BlockSchema = z.object({
  number: z.number().int().nonnegative(),
  hash: BlockHash,
  parentHash: BlockHash,
  timestamp: z.number().int().nonnegative(),
  gasUsed: z.string(),
  gasLimit: z.string(),
  baseFeePerGas: z.string().nullable(),
  txCount: z.number().int().nonnegative(),
  miner: Address,
});
export type Block = z.infer<typeof BlockSchema>;

/** Transaction as stored in the database */
export const TransactionSchema = z.object({
  hash: TxHash,
  blockNumber: z.number().int().nonnegative(),
  from: Address,
  to: Address.nullable(),
  value: z.string(),
  gasUsed: z.string(),
  gasPrice: z.string(),
  maxFeePerGas: z.string().nullable(),
  maxPriorityFeePerGas: z.string().nullable(),
  status: z.enum(['success', 'failure']),
  timestamp: z.number().int().nonnegative(),
  input: HexString,
});
export type Transaction = z.infer<typeof TransactionSchema>;

/** ERC-20 Transfer event decoded from logs */
export const TokenTransferSchema = z.object({
  txHash: TxHash,
  logIndex: z.number().int().nonnegative(),
  tokenAddress: Address,
  from: Address,
  to: Address,
  value: z.string(),
  blockNumber: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
});
export type TokenTransfer = z.infer<typeof TokenTransferSchema>;

/** ERC-20 token metadata */
export const TokenSchema = z.object({
  address: Address,
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
  totalSupply: z.string().nullable(),
});
export type Token = z.infer<typeof TokenSchema>;

/** Materialized token holder balance */
export const TokenHolderSchema = z.object({
  tokenAddress: Address,
  holderAddress: Address,
  balance: z.string(),
  lastUpdated: z.number().int(),
});
export type TokenHolder = z.infer<typeof TokenHolderSchema>;

/** Daily network activity aggregate */
export const DailyActivitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  txCount: z.number().int().nonnegative(),
  activeAccounts: z.number().int().nonnegative(),
  newContracts: z.number().int().nonnegative(),
  totalGasUsed: z.string(),
});
export type DailyActivity = z.infer<typeof DailyActivitySchema>;

/** Daily fee aggregate */
export const DailyFeesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avgGasPrice: z.string(),
  totalBurned: z.string(),
  totalTips: z.string(),
  txCount: z.number().int().nonnegative(),
});
export type DailyFees = z.infer<typeof DailyFeesSchema>;

/** Per-contract daily statistics */
export const ContractDailyStatsSchema = z.object({
  contractAddress: Address,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  txCount: z.number().int().nonnegative(),
  uniqueCallers: z.number().int().nonnegative(),
  gasUsed: z.string(),
});
export type ContractDailyStats = z.infer<typeof ContractDailyStatsSchema>;

/** Per-token daily transfer statistics */
export const TokenDailyStatsSchema = z.object({
  tokenAddress: Address,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transferCount: z.number().int().nonnegative(),
  uniqueSenders: z.number().int().nonnegative(),
  uniqueReceivers: z.number().int().nonnegative(),
  volume: z.string(),
});
export type TokenDailyStats = z.infer<typeof TokenDailyStatsSchema>;

/** DApp tag mapping a contract to a named application and category */
export const DAppTagSchema = z.object({
  contractAddress: Address,
  dappName: z.string().min(1),
  category: z.string().min(1),
  logoUrl: z.string().url().nullable().optional(),
});
export type DAppTag = z.infer<typeof DAppTagSchema>;

/** API key for authenticated access */
export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(32),
  name: z.string().min(1),
  rateLimit: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

/** Shareable dashboard view configuration */
export const SharedViewSchema = z.object({
  slug: z.string().min(6).max(12),
  config: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});
export type SharedView = z.infer<typeof SharedViewSchema>;

/** Webhook subscription for event-driven notifications */
export const WebhookSubscriptionSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  eventType: z.enum(['daily_digest']),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

/** Date range filter (YYYY-MM-DD) */
export const DateRangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Pagination parameters */
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Combined date range + pagination query */
export const DatePaginationQuery = DateRangeQuery.merge(PaginationQuery);

/** Sort parameters for leaderboard-style queries */
export const SortQuery = z.object({
  sort: z.enum(['tx_count', 'gas_used', 'unique_callers']).default('tx_count'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** Contracts endpoint query (date + pagination + sort) */
export const ContractsQuery = DatePaginationQuery.merge(SortQuery);

/** Tokens endpoint query */
export const TokensQuery = DatePaginationQuery;

/** Export endpoint query (date range + format) */
export const ExportQuery = DateRangeQuery.extend({
  format: z.enum(['csv', 'json']).default('json'),
});

/** Request body for creating a share link */
export const CreateShareBody = z.object({
  config: z.record(z.unknown()),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/** Request body for registering a webhook */
export const CreateWebhookBody = z.object({
  url: z.string().url(),
  eventType: z.enum(['daily_digest']),
});

/** Ingestion checkpoint persisted in `sync_state` */
export const SyncStateSchema = z.object({
  id: z.literal(1),
  lastBlock: z.number().int().nonnegative(),
  lastBlockHash: BlockHash,
  updatedAt: z.string().datetime(),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

/** High-level network overview returned by /network/overview */
export const NetworkOverviewSchema = z.object({
  latestBlock: z.number().int(),
  tps: z.number(),
  totalTransactions: z.number().int(),
  avgBlockTime: z.number(),
});
export type NetworkOverview = z.infer<typeof NetworkOverviewSchema>;

/** Transaction success/failure stats returned by /transactions/stats */
export const TransactionStatsSchema = z.object({
  totalSuccess: z.number().int(),
  totalFailure: z.number().int(),
  successRate: z.number(),
});
export type TransactionStats = z.infer<typeof TransactionStatsSchema>;
