import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Probes the sync lag of a node.
 * Returns 0 when fully synced, positive number indicating block/epoch lag otherwise.
 */
export declare class SyncStatusProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "sync_status";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=SyncStatusProbe.d.ts.map