import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Probes the connected peer count of a node.
 */
export declare class PeerCountProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "peer_count";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=PeerCountProbe.d.ts.map