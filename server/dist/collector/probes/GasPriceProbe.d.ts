import type { IProbe, ProbeResult } from "../IProbe";
import { RpcClientFactory } from "../../rpc/RpcClientFactory";
/**
 * Probes the current gas price.
 * Returns value in Gwei (1e9 Wei/Drip) for readability.
 */
export declare class GasPriceProbe implements IProbe {
    private readonly rpcFactory;
    readonly name = "gas_price";
    constructor(rpcFactory: RpcClientFactory);
    execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=GasPriceProbe.d.ts.map