import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Probes the latest block for detailed metrics:
 * transaction count, gas used, gas utilization, and block timestamp.
 */
export declare class BlockDetailProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "block_detail";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=BlockDetailProbe.d.ts.map