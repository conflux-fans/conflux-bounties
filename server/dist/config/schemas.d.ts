import { z } from "zod";
/** Supported Conflux space types */
export declare const SpaceTypeSchema: z.ZodEnum<["core", "espace"]>;
/** Alert severity levels */
export declare const SeveritySchema: z.ZodEnum<["info", "warning", "critical"]>;
/** Alert condition operators */
export declare const ConditionSchema: z.ZodEnum<["gt", "lt", "lag", "consecutive_failures"]>;
/** Supported notification channels */
export declare const ChannelTypeSchema: z.ZodEnum<["console", "slack", "email", "webhook"]>;
/** Schema for a monitored node */
export declare const NodeConfigSchema: z.ZodObject<{
    name: z.ZodString;
    rpcUrl: z.ZodString;
    spaceType: z.ZodEnum<["core", "espace"]>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    rpcUrl: string;
    spaceType: "core" | "espace";
    enabled: boolean;
}, {
    name: string;
    rpcUrl: string;
    spaceType: "core" | "espace";
    enabled?: boolean | undefined;
}>;
/** Schema for a persisted node (includes DB id) */
export declare const NodeSchema: z.ZodObject<{
    name: z.ZodString;
    rpcUrl: z.ZodString;
    spaceType: z.ZodEnum<["core", "espace"]>;
    enabled: z.ZodDefault<z.ZodBoolean>;
} & {
    id: z.ZodString;
    createdAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    rpcUrl: string;
    spaceType: "core" | "espace";
    enabled: boolean;
    id: string;
    createdAt?: string | undefined;
}, {
    name: string;
    rpcUrl: string;
    spaceType: "core" | "espace";
    id: string;
    enabled?: boolean | undefined;
    createdAt?: string | undefined;
}>;
/** Schema for an alert rule definition */
export declare const AlertRuleSchema: z.ZodObject<{
    name: z.ZodString;
    metric: z.ZodString;
    condition: z.ZodEnum<["gt", "lt", "lag", "consecutive_failures"]>;
    threshold: z.ZodNumber;
    severity: z.ZodEnum<["info", "warning", "critical"]>;
    cooldownMs: z.ZodDefault<z.ZodNumber>;
    channels: z.ZodArray<z.ZodEnum<["console", "slack", "email", "webhook"]>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    metric: string;
    condition: "gt" | "lt" | "lag" | "consecutive_failures";
    threshold: number;
    severity: "info" | "warning" | "critical";
    cooldownMs: number;
    channels: ("console" | "slack" | "email" | "webhook")[];
}, {
    name: string;
    metric: string;
    condition: "gt" | "lt" | "lag" | "consecutive_failures";
    threshold: number;
    severity: "info" | "warning" | "critical";
    channels: ("console" | "slack" | "email" | "webhook")[];
    cooldownMs?: number | undefined;
}>;
/** Schema for a triggered alert record */
export declare const AlertSchema: z.ZodObject<{
    id: z.ZodString;
    ruleId: z.ZodString;
    nodeId: z.ZodString;
    metric: z.ZodString;
    value: z.ZodNumber;
    threshold: z.ZodNumber;
    severity: z.ZodEnum<["info", "warning", "critical"]>;
    message: z.ZodString;
    acknowledged: z.ZodDefault<z.ZodBoolean>;
    resolvedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: number;
    message: string;
    id: string;
    createdAt: string;
    metric: string;
    threshold: number;
    severity: "info" | "warning" | "critical";
    ruleId: string;
    nodeId: string;
    acknowledged: boolean;
    resolvedAt: string | null;
}, {
    value: number;
    message: string;
    id: string;
    createdAt: string;
    metric: string;
    threshold: number;
    severity: "info" | "warning" | "critical";
    ruleId: string;
    nodeId: string;
    acknowledged?: boolean | undefined;
    resolvedAt?: string | null | undefined;
}>;
/** Schema for a single metric data point */
export declare const MetricPointSchema: z.ZodObject<{
    nodeId: z.ZodString;
    metricName: z.ZodString;
    value: z.ZodNumber;
    unit: z.ZodDefault<z.ZodString>;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: number;
    nodeId: string;
    metricName: string;
    unit: string;
    timestamp: number;
}, {
    value: number;
    nodeId: string;
    metricName: string;
    timestamp: number;
    unit?: string | undefined;
}>;
/** Schema for the full config.json file */
export declare const AppConfigSchema: z.ZodObject<{
    nodes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        rpcUrl: z.ZodString;
        spaceType: z.ZodEnum<["core", "espace"]>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        rpcUrl: string;
        spaceType: "core" | "espace";
        enabled: boolean;
    }, {
        name: string;
        rpcUrl: string;
        spaceType: "core" | "espace";
        enabled?: boolean | undefined;
    }>, "many">>;
    alertRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        metric: z.ZodString;
        condition: z.ZodEnum<["gt", "lt", "lag", "consecutive_failures"]>;
        threshold: z.ZodNumber;
        severity: z.ZodEnum<["info", "warning", "critical"]>;
        cooldownMs: z.ZodDefault<z.ZodNumber>;
        channels: z.ZodArray<z.ZodEnum<["console", "slack", "email", "webhook"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        metric: string;
        condition: "gt" | "lt" | "lag" | "consecutive_failures";
        threshold: number;
        severity: "info" | "warning" | "critical";
        cooldownMs: number;
        channels: ("console" | "slack" | "email" | "webhook")[];
    }, {
        name: string;
        metric: string;
        condition: "gt" | "lt" | "lag" | "consecutive_failures";
        threshold: number;
        severity: "info" | "warning" | "critical";
        channels: ("console" | "slack" | "email" | "webhook")[];
        cooldownMs?: number | undefined;
    }>, "many">>;
    pollingIntervalMs: z.ZodDefault<z.ZodNumber>;
    retentionDays: z.ZodDefault<z.ZodNumber>;
    maintenanceMode: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    nodes: {
        name: string;
        rpcUrl: string;
        spaceType: "core" | "espace";
        enabled: boolean;
    }[];
    alertRules: {
        name: string;
        metric: string;
        condition: "gt" | "lt" | "lag" | "consecutive_failures";
        threshold: number;
        severity: "info" | "warning" | "critical";
        cooldownMs: number;
        channels: ("console" | "slack" | "email" | "webhook")[];
    }[];
    pollingIntervalMs: number;
    retentionDays: number;
    maintenanceMode: boolean;
}, {
    nodes?: {
        name: string;
        rpcUrl: string;
        spaceType: "core" | "espace";
        enabled?: boolean | undefined;
    }[] | undefined;
    alertRules?: {
        name: string;
        metric: string;
        condition: "gt" | "lt" | "lag" | "consecutive_failures";
        threshold: number;
        severity: "info" | "warning" | "critical";
        channels: ("console" | "slack" | "email" | "webhook")[];
        cooldownMs?: number | undefined;
    }[] | undefined;
    pollingIntervalMs?: number | undefined;
    retentionDays?: number | undefined;
    maintenanceMode?: boolean | undefined;
}>;
/** Schema for environment variables */
export declare const EnvSchema: z.ZodObject<{
    PORT: z.ZodDefault<z.ZodNumber>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    API_KEYS: z.ZodDefault<z.ZodString>;
    DATABASE_PATH: z.ZodDefault<z.ZodString>;
    RETENTION_DAYS: z.ZodDefault<z.ZodNumber>;
    METRIC_INTERVAL_MS: z.ZodDefault<z.ZodNumber>;
    CONFLUX_CORE_RPC_URLS: z.ZodDefault<z.ZodString>;
    CONFLUX_ESPACE_RPC_URLS: z.ZodDefault<z.ZodString>;
    ALERT_SLACK_WEBHOOK: z.ZodDefault<z.ZodString>;
    SMTP_HOST: z.ZodDefault<z.ZodString>;
    SMTP_PORT: z.ZodDefault<z.ZodNumber>;
    SMTP_USER: z.ZodDefault<z.ZodString>;
    SMTP_PASS: z.ZodDefault<z.ZodString>;
    SMTP_FROM: z.ZodDefault<z.ZodString>;
    ALERT_EMAIL_TO: z.ZodDefault<z.ZodString>;
    ALERT_WEBHOOK_URL: z.ZodDefault<z.ZodString>;
    SEED_DEMO: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "production" | "development" | "test";
    PORT: number;
    API_KEYS: string;
    DATABASE_PATH: string;
    RETENTION_DAYS: number;
    METRIC_INTERVAL_MS: number;
    CONFLUX_CORE_RPC_URLS: string;
    CONFLUX_ESPACE_RPC_URLS: string;
    ALERT_SLACK_WEBHOOK: string;
    SMTP_HOST: string;
    SMTP_PORT: number;
    SMTP_USER: string;
    SMTP_PASS: string;
    SMTP_FROM: string;
    ALERT_EMAIL_TO: string;
    ALERT_WEBHOOK_URL: string;
    SEED_DEMO: string;
}, {
    NODE_ENV?: "production" | "development" | "test" | undefined;
    PORT?: number | undefined;
    API_KEYS?: string | undefined;
    DATABASE_PATH?: string | undefined;
    RETENTION_DAYS?: number | undefined;
    METRIC_INTERVAL_MS?: number | undefined;
    CONFLUX_CORE_RPC_URLS?: string | undefined;
    CONFLUX_ESPACE_RPC_URLS?: string | undefined;
    ALERT_SLACK_WEBHOOK?: string | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: number | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
    SMTP_FROM?: string | undefined;
    ALERT_EMAIL_TO?: string | undefined;
    ALERT_WEBHOOK_URL?: string | undefined;
    SEED_DEMO?: string | undefined;
}>;
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
//# sourceMappingURL=schemas.d.ts.map