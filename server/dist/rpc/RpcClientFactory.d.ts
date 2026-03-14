import type { SpaceType } from "../config/schemas";
import type { IRpcClient } from "./interfaces";
/**
 * Factory that returns the correct RPC client based on the node's space type.
 * Caches client instances by URL to avoid creating duplicates.
 */
export declare class RpcClientFactory {
    private readonly cache;
    /** Get or create an RPC client for the given URL and space type */
    getClient(rpcUrl: string, spaceType: SpaceType): IRpcClient;
    /** Clear the client cache */
    clear(): void;
}
//# sourceMappingURL=RpcClientFactory.d.ts.map