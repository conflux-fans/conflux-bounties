"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRepository = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Repository for alert rules and triggered alert records.
 */
class AlertRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /* ───────── Alert Rules ───────── */
    /** Create an alert rule */
    createRule(rule) {
        const id = crypto_1.default.randomUUID();
        this.db
            .prepare(`INSERT INTO alert_rules (id, name, metric, condition, threshold, severity, cooldown_ms, channels)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, rule.name, rule.metric, rule.condition, rule.threshold, rule.severity, rule.cooldownMs, JSON.stringify(rule.channels));
        return id;
    }
    /** Get all alert rules */
    findAllRules() {
        return this.db
            .prepare("SELECT * FROM alert_rules ORDER BY created_at")
            .all();
    }
    /** Get enabled alert rules only */
    findEnabledRules() {
        return this.db
            .prepare("SELECT * FROM alert_rules WHERE enabled = 1 ORDER BY created_at")
            .all();
    }
    /** Delete an alert rule by ID */
    deleteRule(id) {
        const result = this.db
            .prepare("DELETE FROM alert_rules WHERE id = ?")
            .run(id);
        return result.changes > 0;
    }
    /* ───────── Triggered Alerts ───────── */
    /** Record a triggered alert */
    createAlert(alert) {
        const id = crypto_1.default.randomUUID();
        this.db
            .prepare(`INSERT INTO alerts (id, rule_id, node_id, metric, value, threshold, severity, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, alert.ruleId, alert.nodeId, alert.metric, alert.value, alert.threshold, alert.severity, alert.message);
        return id;
    }
    /** Get recent alerts, optionally filtered by node */
    findAlerts(params) {
        const conditions = [];
        const values = [];
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
            .all(...values, limit);
    }
    /** Acknowledge an alert by ID */
    acknowledge(id) {
        const result = this.db
            .prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ?")
            .run(id);
        return result.changes > 0;
    }
    /** Resolve an alert by ID */
    resolve(id) {
        const result = this.db
            .prepare("UPDATE alerts SET resolved_at = datetime('now') WHERE id = ?")
            .run(id);
        return result.changes > 0;
    }
    /** Get unresolved alert count per node */
    getUnresolvedCounts() {
        return this.db
            .prepare(`SELECT node_id, COUNT(*) as count FROM alerts
         WHERE resolved_at IS NULL
         GROUP BY node_id`)
            .all();
    }
}
exports.AlertRepository = AlertRepository;
//# sourceMappingURL=AlertRepository.js.map