"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockDetailProbe = void 0;
/**
 * Probes the latest block for detailed metrics:
 * transaction count, gas used, gas utilization, and block timestamp.
 */
class BlockDetailProbe {
    rpcFactory;
    name = "block_detail";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const block = await client.getLatestBlock();
        const now = Date.now();
        const gasUtilization = block.gasLimit > 0 ? (block.gasUsed / block.gasLimit) * 100 : 0;
        return [
            { nodeId, metricName: "block_tx_count", value: block.txCount, unit: "txns", timestamp: now },
            { nodeId, metricName: "block_gas_used", value: block.gasUsed, unit: "gas", timestamp: now },
            { nodeId, metricName: "gas_utilization", value: Math.round(gasUtilization * 100) / 100, unit: "%", timestamp: now },
            { nodeId, metricName: "block_timestamp", value: block.timestamp, unit: "epoch_s", timestamp: now },
        ];
    }
}
exports.BlockDetailProbe = BlockDetailProbe;
//# sourceMappingURL=BlockDetailProbe.js.map