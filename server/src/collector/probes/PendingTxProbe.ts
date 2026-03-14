import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
import type { SpaceType } from "../../config/schemas";

/**
 * Probes the pending transaction count (mempool size).
 */
export class PendingTxProbe implements IProbe {
  readonly name = "pending_tx";

  constructor(private readonly rpcFactory: RpcClientFactory) {}

  async execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]> {
    const client = this.rpcFactory.getClient(rpcUrl, spaceType as SpaceType);
    const count = await client.getPendingTxCount();
    const now = Date.now();

    return [
      { nodeId, metricName: "pending_tx_count", value: count, unit: "txns", timestamp: now },
    ];
  }
}
