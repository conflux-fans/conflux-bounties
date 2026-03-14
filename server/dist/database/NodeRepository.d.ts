import type BetterSqlite3 from "better-sqlite3";
import type { SpaceType } from "../config/schemas";
/** Row shape for the nodes table */
export interface NodeRow {
    id: string;
    name: string;
    rpc_url: string;
    space_type: SpaceType;
    enabled: number;
    created_at: string;
}
/**
 * Repository for CRUD operations on monitored nodes.
 */
export declare class NodeRepository {
    private readonly db;
    constructor(db: BetterSqlite3.Database);
    /** Insert a new node and return its generated ID */
    create(node: {
        name: string;
        rpcUrl: string;
        spaceType: SpaceType;
        enabled?: boolean;
    }): string;
    /** Get all nodes */
    findAll(): NodeRow[];
    /** Get enabled nodes only */
    findEnabled(): NodeRow[];
    /** Get a single node by ID */
    findById(id: string): NodeRow | undefined;
    /** Update a node's fields */
    update(id: string, fields: Partial<{
        name: string;
        rpcUrl: string;
        spaceType: SpaceType;
        enabled: boolean;
    }>): boolean;
    /** Delete a node by ID */
    delete(id: string): boolean;
}
//# sourceMappingURL=NodeRepository.d.ts.map