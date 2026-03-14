"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GasPriceProbe = void 0;
/**
 * Probes the current gas price.
 * Returns value in Gwei (1e9 Wei/Drip) for readability.
 */
class GasPriceProbe {
    rpcFactory;
    name = "gas_price";
    constructor(rpcFactory) {
        this.rpcFactory = rpcFactory;
    }
    async execute(nodeId, rpcUrl, spaceType) {
        const client = this.rpcFactory.getClient(rpcUrl, spaceType);
        const priceWei = await client.getGasPrice();
        const priceGwei = Number(priceWei) / 1e9;
        const now = Date.now();
        return [
            { nodeId, metricName: "gas_price_gwei", value: priceGwei, unit: "Gwei", timestamp: now },
        ];
    }
}
exports.GasPriceProbe = GasPriceProbe;
//# sourceMappingURL=GasPriceProbe.js.map