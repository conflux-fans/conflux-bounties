import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Probes the current gas price.
 * Returns value in Gwei (1e9 Wei/Drip) for readability.
 */
export class GasPriceProbe implements IProbe {
  readonly name = "gas_price";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const priceWei = await client.getGasPrice();
    const priceGwei = Number(priceWei) / 1e9;
    const now = Date.now();

    return [
      { nodeId, metricName: "gas_price_gwei", value: priceGwei, unit: "Gwei", timestamp: now },
    ];
  }
}
