import { Router } from "express";
import type { MetricRepository } from "../../database/MetricRepository";
import type { NodeRepository } from "../../database/NodeRepository";

/**
 * Build Express router for /metrics (Prometheus text format).
 * Exposes all latest metric values in the Prometheus exposition format.
 */
export function prometheusRoutes(
  metricRepo: MetricRepository,
  nodeRepo: NodeRepository
): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const nodes = nodeRepo.findAll();
    const lines: string[] = [];

    for (const node of nodes) {
      const latest = metricRepo.getLatestByNode(node.id);
      for (const row of latest) {
        const safeName = row.metric_name.replace(/[^a-zA-Z0-9_:]/g, "_");
        const labels = `node_id="${node.id}",node_name="${node.name}",space="${node.space_type}"`;
        lines.push(`# HELP conflux_${safeName} ${row.metric_name} (${row.unit})`);
        lines.push(`# TYPE conflux_${safeName} gauge`);
        lines.push(`conflux_${safeName}{${labels}} ${row.value} ${row.timestamp}`);
      }
    }

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(lines.join("\n") + "\n");
  });

  return router;
}
