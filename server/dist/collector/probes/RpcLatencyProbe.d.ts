import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Measures the round-trip RPC latency to a node.
 */
export declare class RpcLatencyProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "rpc_latency";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=RpcLatencyProbe.d.ts.map