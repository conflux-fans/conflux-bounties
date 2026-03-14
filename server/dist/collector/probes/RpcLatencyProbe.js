"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcLatencyProbe = void 0;
/**
 * Measures the round-trip RPC latency to a node.
 */
class RpcLatencyProbe {
    rpcFactory;
    name = "rpc_latency";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const latency = await client.measureLatency();
        const now = Date.now();
        return [
            { nodeId, metricName: "rpc_latency", value: latency, unit: "ms", timestamp: now },
        ];
    }
}
exports.RpcLatencyProbe = RpcLatencyProbe;
//# sourceMappingURL=RpcLatencyProbe.js.map