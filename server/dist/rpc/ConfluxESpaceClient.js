"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluxESpaceClient = void 0;
const interfaces_1 = require("./interfaces");
/**
 * JSON-RPC client for Conflux eSpace (EVM-compatible).
 * Uses raw fetch() for eth_* / net_* methods.
 */
class ConfluxESpaceClient {
    rpcUrl;
    requestId = 0;
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl;
    }
    /** Send a raw JSON-RPC request and return the parsed result */
    async rpcCall(method, params = []) {
        const id = ++this.requestId;
        const response = await fetch(this.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const json = await response.json();
        const parsed = interfaces_1.JsonRpcResponseSchema.parse(json);
        if (parsed.error) {
            throw new Error(`RPC error ${parsed.error.code}: ${parsed.error.message}`);
        }
        return parsed.result;
    }
    /** Get current block number */
    async getBlockHeight() {
        const hex = await this.rpcCall("eth_blockNumber");
        return parseInt(hex, 16);
    }
    /**
     * Get sync lag via eth_syncing.
     * Returns 0 when synced (eth_syncing returns false).
     */
    async getSyncLag() {
        const raw = await this.rpcCall("eth_syncing");
        const syncing = interfaces_1.EthSyncingSchema.parse(raw);
        if (syncing === false)
            return 0;
        const highest = parseInt(syncing.highestBlock, 16);
        const current = parseInt(syncing.currentBlock, 16);
        return Math.max(0, highest - current);
    }
    /** Get gas price in Wei */
    async getGasPrice() {
        const hex = await this.rpcCall("eth_gasPrice");
        return BigInt(hex);
    }
    /** Get connected peer count via net_peerCount */
    async getPeerCount() {
        const hex = await this.rpcCall("net_peerCount");
        return parseInt(hex, 16);
    }
    /**
     * Get pending transaction count via txpool_status.
     * Falls back to 0 if txpool_status is not supported.
     */
    async getPendingTxCount() {
        try {
            const raw = await this.rpcCall("txpool_status");
            const status = interfaces_1.TxPoolStatusSchema.parse(raw);
            const pending = status.pending ? parseInt(status.pending, 16) : 0;
            const queued = status.queued ? parseInt(status.queued, 16) : 0;
            return pending + queued;
        }
        catch {
            /** txpool_status not available on this node */
            return 0;
        }
    }
    /** Get latest block details via eth_getBlockByNumber */
    async getLatestBlock() {
        const raw = await this.rpcCall("eth_getBlockByNumber", [
            "latest",
            false,
        ]);
        const block = interfaces_1.EthBlockSchema.parse(raw);
        return {
            height: parseInt(block.number, 16),
            hash: block.hash,
            timestamp: parseInt(block.timestamp, 16),
            txCount: block.transactions.length,
            gasUsed: parseInt(block.gasUsed, 16),
            gasLimit: parseInt(block.gasLimit, 16),
        };
    }
    /** Measure round-trip latency via eth_blockNumber */
    async measureLatency() {
        const start = performance.now();
        await this.rpcCall("eth_blockNumber");
        return Math.round(performance.now() - start);
    }
}
exports.ConfluxESpaceClient = ConfluxESpaceClient;
//# sourceMappingURL=ConfluxESpaceClient.js.map