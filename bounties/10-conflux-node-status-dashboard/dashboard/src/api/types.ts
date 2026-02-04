import { z } from "zod";

/** Node row as returned by the API */
export const NodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  rpc_url: z.string(),
  space_type: z.enum(["core", "espace"]),
  enabled: z.number(),
  created_at: z.string(),
});
export type Node = z.infer<typeof NodeSchema>;

/** Metric row as returned by the API */
export const MetricRowSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  metric_name: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.number(),
  created_at: z.string(),
});
export type MetricRow = z.infer<typeof MetricRowSchema>;

/** Alert row as returned by the API */
export const AlertSchema = z.object({
  id: z.string(),
  rule_id: z.string(),
  node_id: z.string(),
  metric: z.string(),
  value: z.number(),
  threshold: z.number(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  acknowledged: z.number(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
});
export type Alert = z.infer<typeof AlertSchema>;

/** Alert rule row */
export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: z.string(),
  condition: z.string(),
  threshold: z.number(),
  severity: z.string(),
  cooldown_ms: z.number(),
  channels: z.string(),
  enabled: z.number(),
  created_at: z.string(),
});
export type AlertRule = z.infer<typeof AlertRuleSchema>;

/** Health check response */
export const HealthSchema = z.object({
  status: z.string(),
  uptime: z.number(),
  activeNodes: z.number(),
  connections: z.number(),
});
export type Health = z.infer<typeof HealthSchema>;

/** WebSocket metric update payload */
export interface MetricsUpdate {
  nodeId: string;
  metrics: Array<{
    metricName: string;
    value: number;
    unit: string;
    timestamp: number;
  }>;
}

/** Alert event payload from WebSocket */
export interface AlertEvent {
  alertId: string;
  ruleName: string;
  nodeId: string;
  nodeName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  timestamp: string;
}

/** Create node request body */
export interface CreateNodeBody {
  name: string;
  rpcUrl: string;
  spaceType: "core" | "espace";
  enabled?: boolean;
}
