"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcClientFactory = void 0;
const ConfluxCoreClient_1 = require("./ConfluxCoreClient");
const ConfluxESpaceClient_1 = require("./ConfluxESpaceClient");
/**
 * Factory that returns the correct RPC client based on the node's space type.
 * Caches client instances by URL to avoid creating duplicates.
 */
class RpcClientFactory {
    cache = new Map();
    /** Get or create an RPC client for the given URL and space type */
    getClient(rpcUrl, spaceType) {
        const key = `${spaceType}:${rpcUrl}`;
        let client = this.cache.get(key);
        if (client)
            return client;
        switch (spaceType) {
            case "core":
                client = new ConfluxCoreClient_1.ConfluxCoreClient(rpcUrl);
                break;
            case "espace":
                client = new ConfluxESpaceClient_1.ConfluxESpaceClient(rpcUrl);
                break;
            default:
                throw new Error(`Unknown space type: ${spaceType}`);
        }
        this.cache.set(key, client);
        return client;
    }
    /** Clear the client cache */
    clear() {
        this.cache.clear();
    }
}
exports.RpcClientFactory = RpcClientFactory;
//# sourceMappingURL=RpcClientFactory.js.map