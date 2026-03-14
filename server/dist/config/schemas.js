"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvSchema = exports.AppConfigSchema = exports.MetricPointSchema = exports.AlertSchema = exports.AlertRuleSchema = exports.NodeSchema = exports.NodeConfigSchema = exports.ChannelTypeSchema = exports.ConditionSchema = exports.SeveritySchema = exports.SpaceTypeSchema = void 0;
const zod_1 = require("zod");
/** Supported Conflux space types */
exports.SpaceTypeSchema = zod_1.z.enum(["core", "espace"]);
/** Alert severity levels */
exports.SeveritySchema = zod_1.z.enum(["info", "warning", "critical"]);
/** Alert condition operators */
exports.ConditionSchema = zod_1.z.enum(["gt", "lt", "lag", "consecutive_failures"]);
/** Supported notification channels */
exports.ChannelTypeSchema = zod_1.z.enum(["console", "slack", "email", "webhook"]);
/** Schema for a monitored node */
exports.NodeConfigSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    rpcUrl: zod_1.z.string().url(),
    spaceType: exports.SpaceTypeSchema,
    enabled: zod_1.z.boolean().default(true),
});
/** Schema for a persisted node (includes DB id) */
exports.NodeSchema = exports.NodeConfigSchema.extend({
    id: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime().optional(),
});
/** Schema for an alert rule definition */
exports.AlertRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    metric: zod_1.z.string().min(1),
    condition: exports.ConditionSchema,
    threshold: zod_1.z.number(),
    severity: exports.SeveritySchema,
    cooldownMs: zod_1.z.number().int().positive().default(300_000),
    channels: zod_1.z.array(exports.ChannelTypeSchema).min(1),
});
/** Schema for a triggered alert record */
exports.AlertSchema = zod_1.z.object({
    id: zod_1.z.string(),
    ruleId: zod_1.z.string(),
    nodeId: zod_1.z.string(),
    metric: zod_1.z.string(),
    value: zod_1.z.number(),
    threshold: zod_1.z.number(),
    severity: exports.SeveritySchema,
    message: zod_1.z.string(),
    acknowledged: zod_1.z.boolean().default(false),
    resolvedAt: zod_1.z.string().datetime().nullable().default(null),
    createdAt: zod_1.z.string().datetime(),
});
/** Schema for a single metric data point */
exports.MetricPointSchema = zod_1.z.object({
    nodeId: zod_1.z.string(),
    metricName: zod_1.z.string(),
    value: zod_1.z.number(),
    unit: zod_1.z.string().default(""),
    timestamp: zod_1.z.number(),
});
/** Schema for the full config.json file */
exports.AppConfigSchema = zod_1.z.object({
    nodes: zod_1.z.array(exports.NodeConfigSchema).default([]),
    alertRules: zod_1.z.array(exports.AlertRuleSchema).default([]),
    pollingIntervalMs: zod_1.z.number().int().positive().default(5000),
    retentionDays: zod_1.z.number().int().positive().default(30),
    maintenanceMode: zod_1.z.boolean().default(false),
});
/** Schema for environment variables */
exports.EnvSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(3001),
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    API_KEYS: zod_1.z.string().default(""),
    DATABASE_PATH: zod_1.z.string().default("./data/dashboard.db"),
    RETENTION_DAYS: zod_1.z.coerce.number().int().positive().default(30),
    METRIC_INTERVAL_MS: zod_1.z.coerce.number().int().positive().default(5000),
    CONFLUX_CORE_RPC_URLS: zod_1.z.string().default("https://main.confluxrpc.com"),
    CONFLUX_ESPACE_RPC_URLS: zod_1.z.string().default("https://evm.confluxrpc.com"),
    ALERT_SLACK_WEBHOOK: zod_1.z.string().default(""),
    SMTP_HOST: zod_1.z.string().default(""),
    SMTP_PORT: zod_1.z.coerce.number().int().default(587),
    SMTP_USER: zod_1.z.string().default(""),
    SMTP_PASS: zod_1.z.string().default(""),
    SMTP_FROM: zod_1.z.string().default("alerts@example.com"),
    ALERT_EMAIL_TO: zod_1.z.string().default(""),
    ALERT_WEBHOOK_URL: zod_1.z.string().default(""),
    SEED_DEMO: zod_1.z.string().default(""),
});
//# sourceMappingURL=schemas.js.map