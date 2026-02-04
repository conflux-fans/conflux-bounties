import BetterSqlite3 from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Logger } from "../utils/Logger";

/**
 * Thin wrapper around better-sqlite3 with WAL mode,
 * automatic directory creation, and migration support.
 */
export class Database {
  public readonly db: BetterSqlite3.Database;
  private readonly logger = new Logger("Database");

  constructor(dbPath: string) {
    /** Ensure the parent directory exists */
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(dbPath);

    /** Enable WAL mode for concurrent reads */
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.logger.info("Database opened", { path: dbPath });
  }

  /** Run all schema migrations */
  migrate(): void {
    this.logger.info("Running migrations");
    this.createTables();
    this.logger.info("Migrations complete");
  }

  /** Create all required tables if they don't exist */
  private createTables(): void {
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
  pruneMetrics(retentionDays: number): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const result = this.db
      .prepare("DELETE FROM metrics WHERE timestamp < ?")
      .run(cutoff);
    this.logger.info(`Pruned ${result.changes} old metric rows`);
    return result.changes;
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
    this.logger.info("Database closed");
  }
}
