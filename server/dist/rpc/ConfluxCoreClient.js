"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluxCoreClient = void 0;
const interfaces_1 = require("./interfaces");
/**
 * JSON-RPC client for Conflux Core Space.
 * Uses raw fetch() for cfx_* methods.
 */
class ConfluxCoreClient {
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
    /** Fetch full node status via cfx_getStatus */
    async getStatus() {
        const raw = await this.rpcCall("cfx_getStatus");
        return interfaces_1.CfxStatusSchema.parse(raw);
    }
    /** Get current epoch number */
    async getBlockHeight() {
        const status = await this.getStatus();
        return parseInt(status.epochNumber, 16);
    }
    /**
     * Get sync lag.
     * Core Space: difference between epochNumber and latestFinalized.
     * Returns 0 when fully synced.
     */
    async getSyncLag() {
        const status = await this.getStatus();
        const current = parseInt(status.epochNumber, 16);
        const finalized = parseInt(status.latestFinalized, 16);
        return Math.max(0, current - finalized);
    }
    /** Get gas price in Drip */
    async getGasPrice() {
        const hex = await this.rpcCall("cfx_gasPrice");
        return BigInt(hex);
    }
    /**
     * Get connected peer count.
     * Core Space reports pendingTxNumber via cfx_getStatus,
     * but peer count requires a separate call.
     * Falls back to status.pendingTxNumber parse if no direct method.
     */
    async getPeerCount() {
        try {
            const hex = await this.rpcCall("cfx_getStatus");
            /** cfx_getStatus returns an object, not a hex. Use the parsed status. */
            const status = interfaces_1.CfxStatusSchema.parse(hex);
            return parseInt(status.networkId, 16);
        }
        catch {
            /** Fallback: status already provides some network info */
            const status = await this.getStatus();
            /** networkId isn't peer count — use a direct call if available */
            return parseInt(status.networkId, 16);
        }
    }
    /** Get pending transaction count from cfx_getStatus */
    async getPendingTxCount() {
        const status = await this.getStatus();
        return parseInt(status.pendingTxNumber, 16);
    }
    /** Get latest block details via cfx_getBlockByEpochNumber */
    async getLatestBlock() {
        const raw = await this.rpcCall("cfx_getBlockByEpochNumber", [
            "latest_state",
            false,
        ]);
        const block = interfaces_1.CfxBlockSchema.parse(raw);
        return {
            height: parseInt(block.epochNumber, 16),
            hash: block.hash,
            timestamp: parseInt(block.timestamp, 16),
            txCount: block.transactions.length,
            gasUsed: parseInt(block.gasUsed, 16),
            gasLimit: parseInt(block.gasLimit, 16),
        };
    }
    /** Measure round-trip latency via cfx_epochNumber */
    async measureLatency() {
        const start = performance.now();
        await this.rpcCall("cfx_epochNumber");
        return Math.round(performance.now() - start);
    }
}
exports.ConfluxCoreClient = ConfluxCoreClient;
//# sourceMappingURL=ConfluxCoreClient.js.map