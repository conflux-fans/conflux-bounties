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
export declare class MetricRepository {
    private readonly db;
    private readonly insertStmt;
    constructor(db: BetterSqlite3.Database);
    /** Insert a single metric data point */
    insert(point: {
        nodeId: string;
        metricName: string;
        value: number;
        unit: string;
        timestamp: number;
    }): void;
    /** Batch-insert multiple metric points in a transaction */
    insertBatch(points: Array<{
        nodeId: string;
        metricName: string;
        value: number;
        unit: string;
        timestamp: number;
    }>): void;
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
    }): MetricRow[];
    /** Get the latest value for each metric name for a given node */
    getLatestByNode(nodeId: string): MetricRow[];
    /** Get all distinct metric names for a node */
    getMetricNames(nodeId: string): string[];
}
//# sourceMappingURL=MetricRepository.d.ts.map