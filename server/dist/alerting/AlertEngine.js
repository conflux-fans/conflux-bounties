"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEngine = void 0;
const Logger_1 = require("../utils/Logger");
const AlertEvaluator_1 = require("./AlertEvaluator");
/**
 * Core alerting engine.
 * Evaluates metric results against alert rules, tracks active alerts,
 * enforces cooldowns, respects maintenance mode, and dispatches notifications.
 */
class AlertEngine {
    alertRepo;
    nodeMap;
    logger = new Logger_1.Logger("AlertEngine");
    evaluator = new AlertEvaluator_1.AlertEvaluator();
    channels = new Map();
    /**
     * Tracks active (unresolved) alerts by a composite key of ruleId:nodeId.
     * Stores the timestamp when the alert was last fired (for cooldown).
     */
    activeAlerts = new Map();
    /** Whether maintenance mode is active (suppresses all alerts) */
    maintenanceMode = false;
    /** Optional callback for real-time alert events */
    onAlert;
    constructor(alertRepo, nodeMap) {
        this.alertRepo = alertRepo;
        this.nodeMap = nodeMap;
    }
    /** Register a notification channel */
    registerChannel(channel) {
        this.channels.set(channel.name, channel);
        this.logger.info(`Registered alert channel: ${channel.name}`);
    }
    /**
     * Process a batch of metric results from the collector.
     * Evaluates each metric against all matching alert rules.
     */
    async processMetrics(results) {
        if (this.maintenanceMode)
            return;
        const rules = this.alertRepo.findEnabledRules();
        if (rules.length === 0)
            return;
        for (const result of results) {
            const matchingRules = rules.filter((r) => {
                /**
                 * For 'consecutive_failures' rules, match against the _error metric
                 * (e.g. rule.metric = "rpc_latency" matches "rpc_latency_error").
                 * For all other conditions, match the metric name directly.
                 */
                if (r.condition === "consecutive_failures") {
                    return result.metricName === `${r.metric}_error`;
                }
                return r.metric === result.metricName;
            });
            for (const rule of matchingRules) {
                await this.evaluateRule(rule, result);
            }
        }
    }
    /** Evaluate a single rule against a metric result */
    async evaluateRule(rule, result) {
        const { triggered, message } = this.evaluator.evaluate(rule, result.value);
        const key = `${rule.id}:${result.nodeId}`;
        if (triggered) {
            /** Check cooldown */
            const lastFired = this.activeAlerts.get(key);
            if (lastFired && Date.now() - lastFired < rule.cooldown_ms) {
                return;
            }
            /** Fire the alert */
            const alertId = this.alertRepo.createAlert({
                ruleId: rule.id,
                nodeId: result.nodeId,
                metric: result.metricName,
                value: result.value,
                threshold: rule.threshold,
                severity: rule.severity,
                message,
            });
            this.activeAlerts.set(key, Date.now());
            const node = this.nodeMap.get(result.nodeId);
            const payload = {
                alertId,
                ruleName: rule.name,
                nodeId: result.nodeId,
                nodeName: node?.name ?? result.nodeId,
                metric: result.metricName,
                value: result.value,
                threshold: rule.threshold,
                severity: rule.severity,
                message,
                timestamp: new Date().toISOString(),
            };
            /** Dispatch to configured channels */
            const channelNames = JSON.parse(rule.channels);
            await this.dispatchToChannels(channelNames, payload);
            this.onAlert?.("triggered", payload);
        }
        else if (this.activeAlerts.has(key)) {
            /** The condition is no longer met — resolve the active alert */
            this.activeAlerts.delete(key);
            const node = this.nodeMap.get(result.nodeId);
            const payload = {
                alertId: "",
                ruleName: rule.name,
                nodeId: result.nodeId,
                nodeName: node?.name ?? result.nodeId,
                metric: result.metricName,
                value: result.value,
                threshold: rule.threshold,
                severity: rule.severity,
                message: `Resolved: ${message}`,
                timestamp: new Date().toISOString(),
            };
            this.onAlert?.("resolved", payload);
        }
    }
    /** Send alert payload to the specified channels */
    async dispatchToChannels(channelNames, payload) {
        const sends = channelNames.map(async (name) => {
            const channel = this.channels.get(name);
            if (!channel) {
                this.logger.warn(`Unknown alert channel: ${name}`);
                return;
            }
            try {
                await channel.send(payload);
            }
            catch (err) {
                this.logger.error(`Channel "${name}" failed`, {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        });
        await Promise.allSettled(sends);
    }
}
exports.AlertEngine = AlertEngine;
//# sourceMappingURL=AlertEngine.js.map