import { z } from "zod";
/**
 * Generic JSON-RPC 2.0 response envelope.
 * Used for both cfx_* and eth_* responses.
 */
export declare const JsonRpcResponseSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodNumber;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: number;
        message: string;
        data?: unknown;
    }, {
        code: number;
        message: string;
        data?: unknown;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: number;
    jsonrpc: "2.0";
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    } | undefined;
}, {
    id: number;
    jsonrpc: "2.0";
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    } | undefined;
}>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
/** cfx_getStatus response shape */
export declare const CfxStatusSchema: z.ZodObject<{
    bestHash: z.ZodString;
    blockNumber: z.ZodString;
    chainId: z.ZodString;
    epochNumber: z.ZodString;
    latestCheckpoint: z.ZodString;
    latestConfirmed: z.ZodString;
    latestFinalized: z.ZodString;
    latestState: z.ZodString;
    networkId: z.ZodString;
    pendingTxNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bestHash: string;
    blockNumber: string;
    chainId: string;
    epochNumber: string;
    latestCheckpoint: string;
    latestConfirmed: string;
    latestFinalized: string;
    latestState: string;
    networkId: string;
    pendingTxNumber: string;
}, {
    bestHash: string;
    blockNumber: string;
    chainId: string;
    epochNumber: string;
    latestCheckpoint: string;
    latestConfirmed: string;
    latestFinalized: string;
    latestState: string;
    networkId: string;
    pendingTxNumber: string;
}>;
export type CfxStatus = z.infer<typeof CfxStatusSchema>;
/** Minimal block shape for cfx_getBlockByEpochNumber */
export declare const CfxBlockSchema: z.ZodObject<{
    epochNumber: z.ZodString;
    blockNumber: z.ZodNullable<z.ZodString>;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodString;
    miner: z.ZodString;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    size: z.ZodString;
    transactionsRoot: z.ZodString;
    transactions: z.ZodArray<z.ZodUnknown, "many">;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    epochNumber: z.ZodString;
    blockNumber: z.ZodNullable<z.ZodString>;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodString;
    miner: z.ZodString;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    size: z.ZodString;
    transactionsRoot: z.ZodString;
    transactions: z.ZodArray<z.ZodUnknown, "many">;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    epochNumber: z.ZodString;
    blockNumber: z.ZodNullable<z.ZodString>;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodString;
    miner: z.ZodString;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    size: z.ZodString;
    transactionsRoot: z.ZodString;
    transactions: z.ZodArray<z.ZodUnknown, "many">;
}, z.ZodTypeAny, "passthrough">>;
export type CfxBlock = z.infer<typeof CfxBlockSchema>;
/** eth_syncing response — false when synced, object when syncing */
export declare const EthSyncingSchema: z.ZodUnion<[z.ZodLiteral<false>, z.ZodObject<{
    startingBlock: z.ZodString;
    currentBlock: z.ZodString;
    highestBlock: z.ZodString;
}, "strip", z.ZodTypeAny, {
    startingBlock: string;
    currentBlock: string;
    highestBlock: string;
}, {
    startingBlock: string;
    currentBlock: string;
    highestBlock: string;
}>]>;
export type EthSyncing = z.infer<typeof EthSyncingSchema>;
/** Minimal block shape for eth_getBlockByNumber */
export declare const EthBlockSchema: z.ZodObject<{
    number: z.ZodString;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodString;
    miner: z.ZodString;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    size: z.ZodString;
    transactions: z.ZodArray<z.ZodUnknown, "many">;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    number: z.ZodString;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodString;
    miner: z.ZodString;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    size: z.ZodString;
    transactions: z.ZodArray<z.ZodUnknown, "many">;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    number: z.ZodString;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodString;
    miner: z.ZodString;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    size: z.ZodString;
    transactions: z.ZodArray<z.ZodUnknown, "many">;
}, z.ZodTypeAny, "passthrough">>;
export type EthBlock = z.infer<typeof EthBlockSchema>;
/** txpool_status response shape */
export declare const TxPoolStatusSchema: z.ZodObject<{
    pending: z.ZodOptional<z.ZodString>;
    queued: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pending?: string | undefined;
    queued?: string | undefined;
}, {
    pending?: string | undefined;
    queued?: string | undefined;
}>;
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
//# sourceMappingURL=interfaces.d.ts.map