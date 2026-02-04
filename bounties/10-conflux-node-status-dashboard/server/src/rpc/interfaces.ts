import { z } from "zod";

/**
 * Generic JSON-RPC 2.0 response envelope.
 * Used for both cfx_* and eth_* responses.
 */
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

/** cfx_getStatus response shape */
export const CfxStatusSchema = z.object({
  bestHash: z.string(),
  blockNumber: z.string(),
  chainId: z.string(),
  epochNumber: z.string(),
  latestCheckpoint: z.string(),
  latestConfirmed: z.string(),
  latestFinalized: z.string(),
  latestState: z.string(),
  networkId: z.string(),
  pendingTxNumber: z.string(),
});

export type CfxStatus = z.infer<typeof CfxStatusSchema>;

/** Minimal block shape for cfx_getBlockByEpochNumber */
export const CfxBlockSchema = z
  .object({
    epochNumber: z.string(),
    blockNumber: z.string().nullable(),
    hash: z.string(),
    parentHash: z.string(),
    timestamp: z.string(),
    miner: z.string(),
    gasLimit: z.string(),
    gasUsed: z.string(),
    size: z.string(),
    transactionsRoot: z.string(),
    transactions: z.array(z.unknown()),
  })
  .passthrough();

export type CfxBlock = z.infer<typeof CfxBlockSchema>;

/** eth_syncing response — false when synced, object when syncing */
export const EthSyncingSchema = z.union([
  z.literal(false),
  z.object({
    startingBlock: z.string(),
    currentBlock: z.string(),
    highestBlock: z.string(),
  }),
]);

export type EthSyncing = z.infer<typeof EthSyncingSchema>;

/** Minimal block shape for eth_getBlockByNumber */
export const EthBlockSchema = z
  .object({
    number: z.string(),
    hash: z.string(),
    parentHash: z.string(),
    timestamp: z.string(),
    miner: z.string(),
    gasLimit: z.string(),
    gasUsed: z.string(),
    size: z.string(),
    transactions: z.array(z.unknown()),
  })
  .passthrough();

export type EthBlock = z.infer<typeof EthBlockSchema>;

/** txpool_status response shape */
export const TxPoolStatusSchema = z.object({
  pending: z.string().optional(),
  queued: z.string().optional(),
});

export type TxPoolStatus = z.infer<typeof TxPoolStatusSchema>;

/**
 * Common interface that both Core and eSpace clients implement.
 * Collector probes program against this interface.
 */
export interface IRpcClient {
  /** The RPC endpoint URL */
  readonly rpcUrl: string;

  /** Get current block/epoch height */
  getBlockHeight(): Promise<number>;

  /** Get sync status — returns lag (0 = synced) */
  getSyncLag(): Promise<number>;

  /** Get current gas price in Drip/Wei */
  getGasPrice(): Promise<bigint>;

  /** Get connected peer count */
  getPeerCount(): Promise<number>;

  /** Get pending transaction count */
  getPendingTxCount(): Promise<number>;

  /** Get latest block details */
  getLatestBlock(): Promise<{
    height: number;
    hash: string;
    timestamp: number;
    txCount: number;
    gasUsed: number;
    gasLimit: number;
  }>;

  /** Measure RPC round-trip latency in ms */
  measureLatency(): Promise<number>;
}
