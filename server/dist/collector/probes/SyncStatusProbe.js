"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncStatusProbe = void 0;
/**
 * Probes the sync lag of a node.
 * Returns 0 when fully synced, positive number indicating block/epoch lag otherwise.
 */
class SyncStatusProbe {
    rpcFactory;
    name = "sync_status";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const lag = await client.getSyncLag();
        const now = Date.now();
        return [
            { nodeId, metricName: "sync_lag", value: lag, unit: "blocks", timestamp: now },
            { nodeId, metricName: "is_synced", value: lag === 0 ? 1 : 0, unit: "bool", timestamp: now },
        ];
    }
}
exports.SyncStatusProbe = SyncStatusProbe;
//# sourceMappingURL=SyncStatusProbe.js.map