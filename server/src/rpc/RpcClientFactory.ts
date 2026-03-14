import type { SpaceType } from "../config/schemas";
import type { IRpcClient } from "./interfaces";
import { ConfluxCoreClient } from "./ConfluxCoreClient";
import { ConfluxESpaceClient } from "./ConfluxESpaceClient";

/**
 * Factory that returns the correct RPC client based on the node's space type.
 * Caches client instances by URL to avoid creating duplicates.
 */
export class RpcClientFactory {
  private readonly cache = new Map<string, IRpcClient>();

  /** Get or create an RPC client for the given URL and space type */
  getClient(rpcUrl: string, spaceType: SpaceType): IRpcClient {
    const key = `${spaceType}:${rpcUrl}`;

    let client = this.cache.get(key);
    if (client) return client;

    switch (spaceType) {
      case "core":
        client = new ConfluxCoreClient(rpcUrl);
        break;
      case "espace":
        client = new ConfluxESpaceClient(rpcUrl);
        break;
      default:
        throw new Error(`Unknown space type: ${spaceType as string}`);
    }

    this.cache.set(key, client);
    return client;
  }

  /** Clear the client cache */
  clear(): void {
    this.cache.clear();
  }
}
