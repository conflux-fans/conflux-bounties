import crypto from "crypto";
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
export class AlertRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  /* ───────── Alert Rules ───────── */

  /** Create an alert rule */
  createRule(rule: {
    name: string;
    metric: string;
    condition: Condition;
    threshold: number;
    severity: Severity;
    cooldownMs: number;
    channels: ChannelType[];
  }): string {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO alert_rules (id, name, metric, condition, threshold, severity, cooldown_ms, channels)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        rule.name,
        rule.metric,
        rule.condition,
        rule.threshold,
        rule.severity,
        rule.cooldownMs,
        JSON.stringify(rule.channels)
      );
    return id;
  }

  /** Get all alert rules */
  findAllRules(): AlertRuleRow[] {
    return this.db
      .prepare("SELECT * FROM alert_rules ORDER BY created_at")
      .all() as AlertRuleRow[];
  }

  /** Get enabled alert rules only */
  findEnabledRules(): AlertRuleRow[] {
    return this.db
      .prepare("SELECT * FROM alert_rules WHERE enabled = 1 ORDER BY created_at")
      .all() as AlertRuleRow[];
  }

  /** Delete an alert rule by ID */
  deleteRule(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM alert_rules WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /* ───────── Triggered Alerts ───────── */

  /** Record a triggered alert */
  createAlert(alert: {
    ruleId: string;
    nodeId: string;
    metric: string;
    value: number;
    threshold: number;
    severity: Severity;
    message: string;
  }): string {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO alerts (id, rule_id, node_id, metric, value, threshold, severity, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        alert.ruleId,
        alert.nodeId,
        alert.metric,
        alert.value,
        alert.threshold,
        alert.severity,
        alert.message
      );
    return id;
  }

  /** Get recent alerts, optionally filtered by node */
  findAlerts(params?: {
    nodeId?: string;
    limit?: number;
    unresolvedOnly?: boolean;
  }): AlertRow[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params?.nodeId) {
      conditions.push("node_id = ?");
      values.push(params.nodeId);
    }
    if (params?.unresolvedOnly) {
      conditions.push("resolved_at IS NULL");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params?.limit ?? 100;

    return this.db
      .prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...values, limit) as AlertRow[];
  }

  /** Acknowledge an alert by ID */
  acknowledge(id: string): boolean {
    const result = this.db
      .prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /** Resolve an alert by ID */
  resolve(id: string): boolean {
    const result = this.db
      .prepare("UPDATE alerts SET resolved_at = datetime('now') WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /** Get unresolved alert count per node */
  getUnresolvedCounts(): Array<{ node_id: string; count: number }> {
    return this.db
      .prepare(
        `SELECT node_id, COUNT(*) as count FROM alerts
         WHERE resolved_at IS NULL
         GROUP BY node_id`
      )
      .all() as Array<{ node_id: string; count: number }>;
  }
}
