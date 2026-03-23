import crypto from "crypto";
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
export class NodeRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  /** Insert a new node and return its generated ID */
  create(node: {
    name: string;
    rpcUrl: string;
    spaceType: SpaceType;
    enabled?: boolean;
  }): string {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO nodes (id, name, rpc_url, space_type, enabled)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, node.name, node.rpcUrl, node.spaceType, node.enabled !== false ? 1 : 0);
    return id;
  }

  /** Get all nodes */
  findAll(): NodeRow[] {
    return this.db.prepare("SELECT * FROM nodes ORDER BY created_at").all() as NodeRow[];
  }

  /** Get enabled nodes only */
  findEnabled(): NodeRow[] {
    return this.db
      .prepare("SELECT * FROM nodes WHERE enabled = 1 ORDER BY created_at")
      .all() as NodeRow[];
  }

  /** Get a single node by ID */
  findById(id: string): NodeRow | undefined {
    return this.db.prepare("SELECT * FROM nodes WHERE id = ?").get(id) as
      | NodeRow
      | undefined;
  }

  /** Update a node's fields */
  update(
    id: string,
    fields: Partial<{ name: string; rpcUrl: string; spaceType: SpaceType; enabled: boolean }>
  ): boolean {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }
    if (fields.rpcUrl !== undefined) {
      sets.push("rpc_url = ?");
      values.push(fields.rpcUrl);
    }
    if (fields.spaceType !== undefined) {
      sets.push("space_type = ?");
      values.push(fields.spaceType);
    }
    if (fields.enabled !== undefined) {
      sets.push("enabled = ?");
      values.push(fields.enabled ? 1 : 0);
    }

    if (sets.length === 0) return false;

    values.push(id);
    const result = this.db
      .prepare(`UPDATE nodes SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
    return result.changes > 0;
  }

  /** Delete a node by ID */
  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
