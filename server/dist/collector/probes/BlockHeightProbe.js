"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockHeightProbe = void 0;
/**
 * Probes the current block/epoch height of a node.
 */
class BlockHeightProbe {
    rpcFactory;
    name = "block_height";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const height = await client.getBlockHeight();
        const now = Date.now();
        return [
            { nodeId, metricName: "block_height", value: height, unit: "blocks", timestamp: now },
        ];
    }
}
exports.BlockHeightProbe = BlockHeightProbe;
//# sourceMappingURL=BlockHeightProbe.js.map