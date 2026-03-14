"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricRepository = void 0;
/**
 * Repository for inserting and querying time-series metric data.
 */
class MetricRepository {
    db;
    insertStmt;
    constructor(db) {
        this.db = db;
        this.insertStmt = this.db.prepare(`INSERT INTO metrics (node_id, metric_name, value, unit, timestamp)
       VALUES (?, ?, ?, ?, ?)`);
    }
    /** Insert a single metric data point */
    insert(point) {
        this.insertStmt.run(point.nodeId, point.metricName, point.value, point.unit, point.timestamp);
    }
    /** Batch-insert multiple metric points in a transaction */
    insertBatch(points) {
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
    query(params) {
        const conditions = ["node_id = ?"];
        const values = [params.nodeId];
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
            .prepare(`SELECT * FROM metrics WHERE ${where} ORDER BY timestamp DESC LIMIT ?`)
            .all(...values, limit);
    }
    /** Get the latest value for each metric name for a given node */
    getLatestByNode(nodeId) {
        return this.db
            .prepare(`SELECT m.* FROM metrics m
         INNER JOIN (
           SELECT metric_name, MAX(timestamp) as max_ts
           FROM metrics
           WHERE node_id = ?
           GROUP BY metric_name
         ) latest ON m.metric_name = latest.metric_name AND m.timestamp = latest.max_ts
         WHERE m.node_id = ?`)
            .all(nodeId, nodeId);
    }
    /** Get all distinct metric names for a node */
    getMetricNames(nodeId) {
        const rows = this.db
            .prepare("SELECT DISTINCT metric_name FROM metrics WHERE node_id = ?")
            .all(nodeId);
        return rows.map((r) => r.metric_name);
    }
}
exports.MetricRepository = MetricRepository;
//# sourceMappingURL=MetricRepository.js.map