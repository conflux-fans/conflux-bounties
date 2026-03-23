import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Probes the sync lag of a node.
 * Returns 0 when fully synced, positive number indicating block/epoch lag otherwise.
 */
export class SyncStatusProbe implements IProbe {
  readonly name = "sync_status";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const lag = await client.getSyncLag();
    const now = Date.now();

    return [
      { nodeId, metricName: "sync_lag", value: lag, unit: "blocks", timestamp: now },
      { nodeId, metricName: "is_synced", value: lag === 0 ? 1 : 0, unit: "bool", timestamp: now },
    ];
  }
}
