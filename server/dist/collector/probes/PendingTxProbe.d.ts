import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Probes the pending transaction count (mempool size).
 */
export declare class PendingTxProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "pending_tx";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=PendingTxProbe.d.ts.map