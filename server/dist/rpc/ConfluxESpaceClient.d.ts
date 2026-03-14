import { type IRpcClient } from "./interfaces";
/**
 * JSON-RPC client for Conflux eSpace (EVM-compatible).
 * Uses raw fetch() for eth_* / net_* methods.
 */
export declare class ConfluxESpaceClient implements IRpcClient {
    readonly rpcUrl: string;
    private requestId;
    constructor(rpcUrl: string);
    /** Send a raw JSON-RPC request and return the parsed result */
    private rpcCall;
    /** Get current block number */
    getBlockHeight(): Promise<number>;
    /**
     * Get sync lag via eth_syncing.
     * Returns 0 when synced (eth_syncing returns false).
     */
    getSyncLag(): Promise<number>;
    /** Get gas price in Wei */
    getGasPrice(): Promise<bigint>;
    /** Get connected peer count via net_peerCount */
    getPeerCount(): Promise<number>;
    /**
     * Get pending transaction count via txpool_status.
     * Falls back to 0 if txpool_status is not supported.
     */
    getPendingTxCount(): Promise<number>;
    /** Get latest block details via eth_getBlockByNumber */
    getLatestBlock(): Promise<{
        height: number;
        hash: string;
        timestamp: number;
        txCount: number;
        gasUsed: number;
        gasLimit: number;
    }>;
    /** Measure round-trip latency via eth_blockNumber */
    measureLatency(): Promise<number>;
}
//# sourceMappingURL=ConfluxESpaceClient.d.ts.map