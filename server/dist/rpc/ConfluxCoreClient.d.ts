import { type IRpcClient, type CfxStatus } from "./interfaces";
/**
 * JSON-RPC client for Conflux Core Space.
 * Uses raw fetch() for cfx_* methods.
 */
export declare class ConfluxCoreClient implements IRpcClient {
    readonly rpcUrl: string;
    private requestId;
    constructor(rpcUrl: string);
    /** Send a raw JSON-RPC request and return the parsed result */
    private rpcCall;
    /** Fetch full node status via cfx_getStatus */
    getStatus(): Promise<CfxStatus>;
    /** Get current epoch number */
    getBlockHeight(): Promise<number>;
    /**
     * Get sync lag.
     * Core Space: difference between epochNumber and latestFinalized.
     * Returns 0 when fully synced.
     */
    getSyncLag(): Promise<number>;
    /** Get gas price in Drip */
    getGasPrice(): Promise<bigint>;
    /**
     * Get connected peer count.
     * Core Space reports pendingTxNumber via cfx_getStatus,
     * but peer count requires a separate call.
     * Falls back to status.pendingTxNumber parse if no direct method.
     */
    getPeerCount(): Promise<number>;
    /** Get pending transaction count from cfx_getStatus */
    getPendingTxCount(): Promise<number>;
    /** Get latest block details via cfx_getBlockByEpochNumber */
    getLatestBlock(): Promise<{
        height: number;
        hash: string;
        timestamp: number;
        txCount: number;
        gasUsed: number;
        gasLimit: number;
    }>;
    /** Measure round-trip latency via cfx_epochNumber */
    measureLatency(): Promise<number>;
}
//# sourceMappingURL=ConfluxCoreClient.d.ts.map