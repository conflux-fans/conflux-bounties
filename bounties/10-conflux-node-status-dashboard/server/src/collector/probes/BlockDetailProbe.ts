import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Probes the latest block for detailed metrics:
 * transaction count, gas used, gas utilization, and block timestamp.
 */
export class BlockDetailProbe implements IProbe {
  readonly name = "block_detail";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const block = await client.getLatestBlock();
    const now = Date.now();

    const gasUtilization =
      block.gasLimit > 0 ? (block.gasUsed / block.gasLimit) * 100 : 0;

    return [
      { nodeId, metricName: "block_tx_count", value: block.txCount, unit: "txns", timestamp: now },
      { nodeId, metricName: "block_gas_used", value: block.gasUsed, unit: "gas", timestamp: now },
      { nodeId, metricName: "gas_utilization", value: Math.round(gasUtilization * 100) / 100, unit: "%", timestamp: now },
      { nodeId, metricName: "block_timestamp", value: block.timestamp, unit: "epoch_s", timestamp: now },
    ];
  }
}
