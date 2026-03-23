import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Probes the current block/epoch height of a node.
 */
export class BlockHeightProbe implements IProbe {
  readonly name = "block_height";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const height = await client.getBlockHeight();
    const now = Date.now();

    return [
      { nodeId, metricName: "block_height", value: height, unit: "blocks", timestamp: now },
    ];
  }
}
