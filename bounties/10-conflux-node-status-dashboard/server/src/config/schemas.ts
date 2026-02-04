import { z } from "zod";

/** Supported Conflux space types */
export const SpaceTypeSchema = z.enum(["core", "espace"]);

/** Alert severity levels */
export const SeveritySchema = z.enum(["info", "warning", "critical"]);

/** Alert condition operators */
export const ConditionSchema = z.enum(["gt", "lt", "lag", "consecutive_failures"]);

/** Supported notification channels */
export const ChannelTypeSchema = z.enum(["console", "slack", "email", "webhook"]);

/** Schema for a monitored node */
export const NodeConfigSchema = z.object({
  name: z.string().min(1),
  rpcUrl: z.string().url(),
  spaceType: SpaceTypeSchema,
  enabled: z.boolean().default(true),
});

/** Schema for a persisted node (includes DB id) */
export const NodeSchema = NodeConfigSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime().optional(),
});

/** Schema for an alert rule definition */
export const AlertRuleSchema = z.object({
  name: z.string().min(1),
  metric: z.string().min(1),
  condition: ConditionSchema,
  threshold: z.number(),
  severity: SeveritySchema,
  cooldownMs: z.number().int().positive().default(300_000),
  channels: z.array(ChannelTypeSchema).min(1),
});

/** Schema for a triggered alert record */
export const AlertSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  nodeId: z.string(),
  metric: z.string(),
  value: z.number(),
  threshold: z.number(),
  severity: SeveritySchema,
  message: z.string(),
  acknowledged: z.boolean().default(false),
  resolvedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
});

/** Schema for a single metric data point */
export const MetricPointSchema = z.object({
  nodeId: z.string(),
  metricName: z.string(),
  value: z.number(),
  unit: z.string().default(""),
  timestamp: z.number(),
});

/** Schema for the full config.json file */
export const AppConfigSchema = z.object({
  nodes: z.array(NodeConfigSchema).default([]),
  alertRules: z.array(AlertRuleSchema).default([]),
  pollingIntervalMs: z.number().int().positive().default(5000),
  retentionDays: z.number().int().positive().default(30),
  maintenanceMode: z.boolean().default(false),
});

/** Schema for environment variables */
export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_KEYS: z.string().default(""),
  DATABASE_PATH: z.string().default("./data/dashboard.db"),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  METRIC_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  CONFLUX_CORE_RPC_URLS: z.string().default("https://main.confluxrpc.com"),
  CONFLUX_ESPACE_RPC_URLS: z.string().default("https://evm.confluxrpc.com"),
  ALERT_SLACK_WEBHOOK: z.string().default(""),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("alerts@example.com"),
  ALERT_EMAIL_TO: z.string().default(""),
  ALERT_WEBHOOK_URL: z.string().default(""),
});

/** Inferred TypeScript types from Zod schemas */
export type SpaceType = z.infer<typeof SpaceTypeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
export type NodeConfig = z.infer<typeof NodeConfigSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type MetricPoint = z.infer<typeof MetricPointSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type EnvConfig = z.infer<typeof EnvSchema>;
