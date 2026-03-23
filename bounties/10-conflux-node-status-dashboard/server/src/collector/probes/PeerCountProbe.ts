import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Probes the connected peer count of a node.
 */
export class PeerCountProbe implements IProbe {
  readonly name = "peer_count";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const count = await client.getPeerCount();
    const now = Date.now();

    return [
      { nodeId, metricName: "peer_count", value: count, unit: "peers", timestamp: now },
    ];
  }
}
