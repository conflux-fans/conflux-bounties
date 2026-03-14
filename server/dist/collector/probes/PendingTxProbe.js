"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingTxProbe = void 0;
/**
 * Probes the pending transaction count (mempool size).
 */
class PendingTxProbe {
    rpcFactory;
    name = "pending_tx";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const count = await client.getPendingTxCount();
        const now = Date.now();
        return [
            { nodeId, metricName: "pending_tx_count", value: count, unit: "txns", timestamp: now },
        ];
    }
}
exports.PendingTxProbe = PendingTxProbe;
//# sourceMappingURL=PendingTxProbe.js.map