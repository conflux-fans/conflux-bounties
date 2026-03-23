import { Logger } from "../utils/Logger";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import type { ProbeRegistry } from "./ProbeRegistry";
import type { ProbeResult } from "./IProbe";
import type { NodeRow } from "../database/NodeRepository";

/** Callback invoked when new metric results are available */
export type OnMetricsCallback = (results: ProbeResult[]) => void;

/**
 * Schedules periodic probe execution for each monitored node.
 * Runs all registered probes per node on each tick, with retry + backoff on failure.
 * Feeds results to the provided callback (which stores to DB, broadcasts via WS, etc.).
 */
export class ProbeScheduler {
  private readonly logger = new Logger("ProbeScheduler");
  private readonly intervals = new Map<string, ReturnType<typeof setInterval>>();
  private readonly failureCounts = new Map<string, number>();

  constructor(
    private readonly registry: ProbeRegistry,
    private readonly intervalMs: number,
    private readonly onMetrics: OnMetricsCallback
  ) {}

  /** Start polling for a specific node */
  startNode(node: NodeRow): void {
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
  stopNode(nodeId: string): void {
    const handle = this.intervals.get(nodeId);
    if (handle) {
      clearInterval(handle);
      this.intervals.delete(nodeId);
      this.failureCounts.delete(nodeId);
      this.logger.info(`Stopped polling for node: ${nodeId}`);
    }
  }

  /** Stop all polling */
  stopAll(): void {
    for (const [nodeId, handle] of this.intervals) {
      clearInterval(handle);
      this.logger.info(`Stopped polling for node: ${nodeId}`);
    }
    this.intervals.clear();
    this.failureCounts.clear();
  }

  /** Get the set of currently active node IDs */
  getActiveNodeIds(): string[] {
    return Array.from(this.intervals.keys());
  }

  /** Execute all probes for a single node */
  private async pollNode(node: NodeRow): Promise<void> {
    const probes = this.registry.getAll();
    const allResults: ProbeResult[] = [];

    for (const probe of probes) {
      try {
        const results = await retryWithBackoff(
          () => probe.execute(node.id, node.rpc_url, node.space_type),
          { maxAttempts: 2, baseDelayMs: 500 }
        );
        allResults.push(...results);

        /** Reset failure count on success */
        this.failureCounts.delete(`${node.id}:${probe.name}`);
      } catch (err) {
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
  getFailureCount(nodeId: string, probeName: string): number {
    return this.failureCounts.get(`${nodeId}:${probeName}`) ?? 0;
  }
}
