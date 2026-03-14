"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricRoutes = metricRoutes;
const express_1 = require("express");
const zod_1 = require("zod");
const csvExporter_1 = require("../../utils/csvExporter");
/** Query params schema for metric queries */
const MetricQuerySchema = zod_1.z.object({
    nodeId: zod_1.z.string().min(1),
    metricName: zod_1.z.string().optional(),
    from: zod_1.z.coerce.number().optional(),
    to: zod_1.z.coerce.number().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(10000).optional(),
});
/**
 * Build Express router for /api/v1/metrics endpoints.
 * Provides time-series metric queries and CSV export.
 */
function metricRoutes(metricRepo, nodeRepo) {
    const router = (0, express_1.Router)();
    /** GET /api/v1/metrics — query metrics with filters */
    router.get("/", (req, res) => {
        const params = MetricQuerySchema.parse(req.query);
        const rows = metricRepo.query(params);
        res.json(rows);
    });
    /** GET /api/v1/metrics/latest/:nodeId — get latest value per metric */
    router.get("/latest/:nodeId", (req, res) => {
        const rows = metricRepo.getLatestByNode(req.params.nodeId);
        res.json(rows);
    });
    /** GET /api/v1/metrics/names/:nodeId — get distinct metric names */
    router.get("/names/:nodeId", (req, res) => {
        const names = metricRepo.getMetricNames(req.params.nodeId);
        res.json(names);
    });
    /** GET /api/v1/metrics/export — download metrics as CSV */
    router.get("/export", (req, res) => {
        const params = MetricQuerySchema.parse(req.query);
        const rows = metricRepo.query({ ...params, limit: params.limit ?? 10000 });
        const csvData = rows.map((r) => ({
            timestamp: new Date(r.timestamp).toISOString(),
            node_id: r.node_id,
            metric_name: r.metric_name,
            value: r.value,
            unit: r.unit,
        }));
        const csv = (0, csvExporter_1.toCsv)(csvData);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="metrics-${params.nodeId}-${Date.now()}.csv"`);
        res.send(csv);
    });
    /** GET /metrics — Prometheus metrics endpoint */
    router.get("/prometheus", (_req, res) => {
        res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        const nodes = nodeRepo.findAll();
        const lines = [];
        for (const node of nodes) {
            const latestMetrics = metricRepo.getLatestByNode(node.id);
            for (const metric of latestMetrics) {
                const metricName = metric.metric_name.replace(/[^a-zA-Z0-9_]/g, "_");
                const nodeName = node.name.replace(/[^a-zA-Z0-9_]/g, "_");
                lines.push(`conflux_node_${metricName}{node="${nodeName}",node_id="${metric.node_id}"} ${metric.value} ${metric.timestamp * 1000}`);
            }
        }
        res.send(lines.join("\n") + "\n");
    });
    return router;
}
//# sourceMappingURL=metricRoutes.js.map