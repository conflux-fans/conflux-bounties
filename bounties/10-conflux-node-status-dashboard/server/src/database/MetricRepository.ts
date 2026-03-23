import type BetterSqlite3 from "better-sqlite3";

/** Row shape for the metrics table */
export interface MetricRow {
  id: number;
  node_id: string;
  metric_name: string;
  value: number;
  unit: string;
  timestamp: number;
  created_at: string;
}

/**
 * Repository for inserting and querying time-series metric data.
 */
export class MetricRepository {
  private readonly insertStmt: BetterSqlite3.Statement;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.insertStmt = this.db.prepare(
      `INSERT INTO metrics (node_id, metric_name, value, unit, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    );
  }

  /** Insert a single metric data point */
  insert(point: {
    nodeId: string;
    metricName: string;
    value: number;
    unit: string;
    timestamp: number;
  }): void {
    this.insertStmt.run(
      point.nodeId,
      point.metricName,
      point.value,
      point.unit,
      point.timestamp
    );
  }

  /** Batch-insert multiple metric points in a transaction */
  insertBatch(
    points: Array<{
      nodeId: string;
      metricName: string;
      value: number;
      unit: string;
      timestamp: number;
    }>
  ): void {
    const txn = this.db.transaction(() => {
      for (const p of points) {
        this.insertStmt.run(p.nodeId, p.metricName, p.value, p.unit, p.timestamp);
      }
    });
    txn();
  }

  /**
   * Query metrics for a node within a time range.
   * Optionally filter by metric name.
   */
  query(params: {
    nodeId: string;
    metricName?: string;
    from?: number;
    to?: number;
    limit?: number;
  }): MetricRow[] {
    const conditions: string[] = ["node_id = ?"];
    const values: unknown[] = [params.nodeId];

    if (params.metricName) {
      conditions.push("metric_name = ?");
      values.push(params.metricName);
    }
    if (params.from) {
      conditions.push("timestamp >= ?");
      values.push(params.from);
    }
    if (params.to) {
      conditions.push("timestamp <= ?");
      values.push(params.to);
    }

    const where = conditions.join(" AND ");
    const limit = params.limit ?? 1000;

    return this.db
      .prepare(
        `SELECT * FROM metrics WHERE ${where} ORDER BY timestamp DESC LIMIT ?`
      )
      .all(...values, limit) as MetricRow[];
  }

  /** Get the latest value for each metric name for a given node */
  getLatestByNode(nodeId: string): MetricRow[] {
    return this.db
      .prepare(
        `SELECT m.* FROM metrics m
         INNER JOIN (
           SELECT metric_name, MAX(timestamp) as max_ts
           FROM metrics
           WHERE node_id = ?
           GROUP BY metric_name
         ) latest ON m.metric_name = latest.metric_name AND m.timestamp = latest.max_ts
         WHERE m.node_id = ?`
      )
      .all(nodeId, nodeId) as MetricRow[];
  }

  /** Get all distinct metric names for a node */
  getMetricNames(nodeId: string): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT metric_name FROM metrics WHERE node_id = ?")
      .all(nodeId) as Array<{ metric_name: string }>;
    return rows.map((r) => r.metric_name);
  }
}
