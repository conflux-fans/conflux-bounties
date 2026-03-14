"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxPoolStatusSchema = exports.EthBlockSchema = exports.EthSyncingSchema = exports.CfxBlockSchema = exports.CfxStatusSchema = exports.JsonRpcResponseSchema = void 0;
const zod_1 = require("zod");
/**
 * Generic JSON-RPC 2.0 response envelope.
 * Used for both cfx_* and eth_* responses.
 */
exports.JsonRpcResponseSchema = zod_1.z.object({
    jsonrpc: zod_1.z.literal("2.0"),
    id: zod_1.z.number(),
    result: zod_1.z.unknown().optional(),
    error: zod_1.z
        .object({
        code: zod_1.z.number(),
        message: zod_1.z.string(),
        data: zod_1.z.unknown().optional(),
    })
        .optional(),
});
/** cfx_getStatus response shape */
exports.CfxStatusSchema = zod_1.z.object({
    bestHash: zod_1.z.string(),
    blockNumber: zod_1.z.string(),
    chainId: zod_1.z.string(),
    epochNumber: zod_1.z.string(),
    latestCheckpoint: zod_1.z.string(),
    latestConfirmed: zod_1.z.string(),
    latestFinalized: zod_1.z.string(),
    latestState: zod_1.z.string(),
    networkId: zod_1.z.string(),
    pendingTxNumber: zod_1.z.string(),
});
/** Minimal block shape for cfx_getBlockByEpochNumber */
exports.CfxBlockSchema = zod_1.z
    .object({
    epochNumber: zod_1.z.string(),
    blockNumber: zod_1.z.string().nullable(),
    hash: zod_1.z.string(),
    parentHash: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    miner: zod_1.z.string(),
    gasLimit: zod_1.z.string(),
    gasUsed: zod_1.z.string(),
    size: zod_1.z.string(),
    transactionsRoot: zod_1.z.string(),
    transactions: zod_1.z.array(zod_1.z.unknown()),
})
    .passthrough();
/** eth_syncing response — false when synced, object when syncing */
exports.EthSyncingSchema = zod_1.z.union([
    zod_1.z.literal(false),
    zod_1.z.object({
        startingBlock: zod_1.z.string(),
        currentBlock: zod_1.z.string(),
        highestBlock: zod_1.z.string(),
    }),
]);
/** Minimal block shape for eth_getBlockByNumber */
exports.EthBlockSchema = zod_1.z
    .object({
    number: zod_1.z.string(),
    hash: zod_1.z.string(),
    parentHash: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    miner: zod_1.z.string(),
    gasLimit: zod_1.z.string(),
    gasUsed: zod_1.z.string(),
    size: zod_1.z.string(),
    transactions: zod_1.z.array(zod_1.z.unknown()),
})
    .passthrough();
/** txpool_status response shape */
exports.TxPoolStatusSchema = zod_1.z.object({
    pending: zod_1.z.string().optional(),
    queued: zod_1.z.string().optional(),
});
//# sourceMappingURL=interfaces.js.map