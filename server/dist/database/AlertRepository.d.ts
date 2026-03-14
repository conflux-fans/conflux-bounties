import type BetterSqlite3 from "better-sqlite3";
import type { Severity, ChannelType, Condition } from "../config/schemas";
/** Row shape for the alert_rules table */
export interface AlertRuleRow {
    id: string;
    name: string;
    metric: string;
    condition: Condition;
    threshold: number;
    severity: Severity;
    cooldown_ms: number;
    channels: string;
    enabled: number;
    created_at: string;
}
/** Row shape for the alerts table */
export interface AlertRow {
    id: string;
    rule_id: string;
    node_id: string;
    metric: string;
    value: number;
    threshold: number;
    severity: Severity;
    message: string;
    acknowledged: number;
    resolved_at: string | null;
    created_at: string;
}
/**
 * Repository for alert rules and triggered alert records.
 */
export declare class AlertRepository {
    private readonly db;
    constructor(db: BetterSqlite3.Database);
    /** Create an alert rule */
    createRule(rule: {
        name: string;
        metric: string;
        condition: Condition;
        threshold: number;
        severity: Severity;
        cooldownMs: number;
        channels: ChannelType[];
    }): string;
    /** Get all alert rules */
    findAllRules(): AlertRuleRow[];
    /** Get enabled alert rules only */
    findEnabledRules(): AlertRuleRow[];
    /** Delete an alert rule by ID */
    deleteRule(id: string): boolean;
    /** Record a triggered alert */
    createAlert(alert: {
        ruleId: string;
        nodeId: string;
        metric: string;
        value: number;
        threshold: number;
        severity: Severity;
        message: string;
    }): string;
    /** Get recent alerts, optionally filtered by node */
    findAlerts(params?: {
        nodeId?: string;
        limit?: number;
        unresolvedOnly?: boolean;
    }): AlertRow[];
    /** Acknowledge an alert by ID */
    acknowledge(id: string): boolean;
    /** Resolve an alert by ID */
    resolve(id: string): boolean;
    /** Get unresolved alert count per node */
    getUnresolvedCounts(): Array<{
        node_id: string;
        count: number;
    }>;
}
//# sourceMappingURL=AlertRepository.d.ts.map