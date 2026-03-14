"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Logger_1 = require("../utils/Logger");
/**
 * Thin wrapper around better-sqlite3 with WAL mode,
 * automatic directory creation, and migration support.
 */
class Database {
    db;
    logger = new Logger_1.Logger("Database");
    constructor(dbPath) {
        /** Ensure the parent directory exists */
        const dir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(dbPath);
        /** Enable WAL mode for concurrent reads */
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.logger.info("Database opened", { path: dbPath });
    }
    /** Run all schema migrations */
    migrate() {
        this.logger.info("Running migrations");
        this.createTables();
        this.logger.info("Migrations complete");
    }
    /** Create all required tables if they don't exist */
    createTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        rpc_url       TEXT NOT NULL,
        space_type    TEXT NOT NULL CHECK(space_type IN ('core', 'espace')),
        enabled       INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id       TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        metric_name   TEXT NOT NULL,
        value         REAL NOT NULL,
        unit          TEXT NOT NULL DEFAULT '',
        timestamp     INTEGER NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_node_time
        ON metrics(node_id, metric_name, timestamp);

      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
        ON metrics(timestamp);

      CREATE TABLE IF NOT EXISTS alert_rules (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        metric        TEXT NOT NULL,
        condition     TEXT NOT NULL,
        threshold     REAL NOT NULL,
        severity      TEXT NOT NULL DEFAULT 'warning',
        cooldown_ms   INTEGER NOT NULL DEFAULT 300000,
        channels      TEXT NOT NULL DEFAULT '["console"]',
        enabled       INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id              TEXT PRIMARY KEY,
        rule_id         TEXT NOT NULL,
        node_id         TEXT NOT NULL,
        metric          TEXT NOT NULL,
        value           REAL NOT NULL,
        threshold       REAL NOT NULL,
        severity        TEXT NOT NULL,
        message         TEXT NOT NULL,
        acknowledged    INTEGER NOT NULL DEFAULT 0,
        resolved_at     TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_node
        ON alerts(node_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_alerts_unresolved
        ON alerts(resolved_at) WHERE resolved_at IS NULL;
    `);
    }
    /**
     * Prune metrics older than the given number of days.
     * Called periodically to keep the database size manageable.
     */
    pruneMetrics(retentionDays) {
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const result = this.db
            .prepare("DELETE FROM metrics WHERE timestamp < ?")
            .run(cutoff);
        this.logger.info(`Pruned ${result.changes} old metric rows`);
        return result.changes;
    }
    /** Close the database connection */
    close() {
        this.db.close();
        this.logger.info("Database closed");
    }
}
exports.Database = Database;
//# sourceMappingURL=Database.js.map