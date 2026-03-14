"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeScheduler = void 0;
const Logger_1 = require("../utils/Logger");
const retryWithBackoff_1 = require("../utils/retryWithBackoff");
/**
 * Schedules periodic probe execution for each monitored node.
 * Runs all registered probes per node on each tick, with retry + backoff on failure.
 * Feeds results to the provided callback (which stores to DB, broadcasts via WS, etc.).
 */
class ProbeScheduler {
    registry;
    intervalMs;
    onMetrics;
    logger = new Logger_1.Logger("ProbeScheduler");
    intervals = new Map();
    failureCounts = new Map();
    constructor(registry, intervalMs, onMetrics) {
        this.registry = registry;
        this.intervalMs = intervalMs;
        this.onMetrics = onMetrics;
    }
    /** Start polling for a specific node */
    startNode(node) {
        if (this.intervals.has(node.id)) {
            this.logger.warn(`Already polling node ${node.name} (${node.id})`);
            return;
        }
        this.logger.info(`Starting polling for node: ${node.name}`, {
            nodeId: node.id,
            interval: this.intervalMs,
        });
        /** Run immediately, then on interval */
        this.pollNode(node);
        const handle = setInterval(() => this.pollNode(node), this.intervalMs);
        this.intervals.set(node.id, handle);
    }
    /** Stop polling for a specific node */
    stopNode(nodeId) {
        const handle = this.intervals.get(nodeId);
        if (handle) {
            clearInterval(handle);
            this.intervals.delete(nodeId);
            this.failureCounts.delete(nodeId);
            this.logger.info(`Stopped polling for node: ${nodeId}`);
        }
    }
    /** Stop all polling */
    stopAll() {
        for (const [nodeId, handle] of this.intervals) {
            clearInterval(handle);
            this.logger.info(`Stopped polling for node: ${nodeId}`);
        }
        this.intervals.clear();
        this.failureCounts.clear();
    }
    /** Get the set of currently active node IDs */
    getActiveNodeIds() {
        return Array.from(this.intervals.keys());
    }
    /** Execute all probes for a single node */
    async pollNode(node) {
        const probes = this.registry.getAll();
        const allResults = [];
        for (const probe of probes) {
            try {
                const results = await (0, retryWithBackoff_1.retryWithBackoff)(() => probe.execute(node.id, node.rpc_url, node.space_type), { maxAttempts: 2, baseDelayMs: 500 });
                allResults.push(...results);
                /** Reset failure count on success */
                this.failureCounts.delete(`${node.id}:${probe.name}`);
            }
            catch (err) {
                const key = `${node.id}:${probe.name}`;
                const count = (this.failureCounts.get(key) ?? 0) + 1;
                this.failureCounts.set(key, count);
                this.logger.error(`Probe "${probe.name}" failed for node ${node.name}`, {
                    nodeId: node.id,
                    error: err instanceof Error ? err.message : String(err),
                    consecutiveFailures: count,
                });
                /** Emit a failure metric so the alert engine can track consecutive failures */
                allResults.push({
                    nodeId: node.id,
                    metricName: `${probe.name}_error`,
                    value: count,
                    unit: "failures",
                    timestamp: Date.now(),
                });
            }
        }
        if (allResults.length > 0) {
            this.onMetrics(allResults);
        }
    }
    /** Get consecutive failure count for a node+probe */
    getFailureCount(nodeId, probeName) {
        return this.failureCounts.get(`${nodeId}:${probeName}`) ?? 0;
    }
}
exports.ProbeScheduler = ProbeScheduler;
//# sourceMappingURL=ProbeScheduler.js.map