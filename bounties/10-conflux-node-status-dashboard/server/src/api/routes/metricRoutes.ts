import { Router } from "express";
import { z } from "zod";
import type { MetricRepository } from "../../database/MetricRepository";
import { toCsv } from "../../utils/csvExporter";

/** Query params schema for metric queries */
const MetricQuerySchema = z.object({
  nodeId: z.string().min(1),
  metricName: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  limit: z.coerce.number().int().positive().max(10000).optional(),
});

/**
 * Build Express router for /api/v1/metrics endpoints.
 * Provides time-series metric queries and CSV export.
 */
export function metricRoutes(metricRepo: MetricRepository): Router {
  const router = Router();

  /** GET /api/v1/metrics — query metrics with filters */
  router.get("/", (req, res) => {
    const params = MetricQuerySchema.parse(req.query);
    const rows = metricRepo.query(params);
    res.json(rows);
  });

  /** GET /api/v1/metrics/latest/:nodeId — get latest value per metric */
  router.get("/latest/:nodeId", (req, res) => {
    const rows = metricRepo.getLatestByNode(req.params.nodeId!);
    res.json(rows);
  });

  /** GET /api/v1/metrics/names/:nodeId — get distinct metric names */
  router.get("/names/:nodeId", (req, res) => {
    const names = metricRepo.getMetricNames(req.params.nodeId!);
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

    const csv = toCsv(csvData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="metrics-${params.nodeId}-${Date.now()}.csv"`
    );
    res.send(csv);
  });

  return router;
}
