import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Probes the current block/epoch height of a node.
 */
export declare class BlockHeightProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "block_height";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=BlockHeightProbe.d.ts.map