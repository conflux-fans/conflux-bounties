"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerCountProbe = void 0;
/**
 * Probes the connected peer count of a node.
 */
class PeerCountProbe {
    rpcFactory;
    name = "peer_count";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const count = await client.getPeerCount();
        const now = Date.now();
        return [
            { nodeId, metricName: "peer_count", value: count, unit: "peers", timestamp: now },
        ];
    }
}
exports.PeerCountProbe = PeerCountProbe;
//# sourceMappingURL=PeerCountProbe.js.map