"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRepository = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Repository for CRUD operations on monitored nodes.
 */
class NodeRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Insert a new node and return its generated ID */
    create(node) {
        const id = crypto_1.default.randomUUID();
        this.db
            .prepare(`INSERT INTO nodes (id, name, rpc_url, space_type, enabled)
         VALUES (?, ?, ?, ?, ?)`)
            .run(id, node.name, node.rpcUrl, node.spaceType, node.enabled !== false ? 1 : 0);
        return id;
    }
    /** Get all nodes */
    findAll() {
        return this.db.prepare("SELECT * FROM nodes ORDER BY created_at").all();
    }
    /** Get enabled nodes only */
    findEnabled() {
        return this.db
            .prepare("SELECT * FROM nodes WHERE enabled = 1 ORDER BY created_at")
            .all();
    }
    /** Get a single node by ID */
    findById(id) {
        return this.db.prepare("SELECT * FROM nodes WHERE id = ?").get(id);
    }
    /** Update a node's fields */
    update(id, fields) {
        const sets = [];
        const values = [];
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
        if (sets.length === 0)
            return false;
        values.push(id);
        const result = this.db
            .prepare(`UPDATE nodes SET ${sets.join(", ")} WHERE id = ?`)
            .run(...values);
        return result.changes > 0;
    }
    /** Delete a node by ID */
    delete(id) {
        const result = this.db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
        return result.changes > 0;
    }
}
exports.NodeRepository = NodeRepository;
//# sourceMappingURL=NodeRepository.js.map