import { Router } from "express";
import type { MetricRepository } from "../../database/MetricRepository";
import type { NodeRepository } from "../../database/NodeRepository";
/**
 * Build Express router for /api/v1/metrics endpoints.
 * Provides time-series metric queries and CSV export.
 */
export declare function metricRoutes(metricRepo: MetricRepository, nodeRepo: NodeRepository): Router;
//# sourceMappingURL=metricRoutes.d.ts.map