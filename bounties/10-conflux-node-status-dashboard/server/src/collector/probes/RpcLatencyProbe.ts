import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Measures the round-trip RPC latency to a node.
 */
export class RpcLatencyProbe implements IProbe {
  readonly name = "rpc_latency";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const latency = await client.measureLatency();
    const now = Date.now();

    return [
      { nodeId, metricName: "rpc_latency", value: latency, unit: "ms", timestamp: now },
    ];
  }
}
