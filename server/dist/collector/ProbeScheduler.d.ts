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
export declare class ProbeScheduler {
    private readonly registry;
    private readonly intervalMs;
    private readonly onMetrics;
    private readonly logger;
    private readonly intervals;
    private readonly failureCounts;
    constructor(registry: ProbeRegistry, intervalMs: number, onMetrics: OnMetricsCallback);
    /** Start polling for a specific node */
    startNode(node: NodeRow): void;
    /** Stop polling for a specific node */
    stopNode(nodeId: string): void;
    /** Stop all polling */
    stopAll(): void;
    /** Get the set of currently active node IDs */
    getActiveNodeIds(): string[];
    /** Execute all probes for a single node */
    private pollNode;
    /** Get consecutive failure count for a node+probe */
    getFailureCount(nodeId: string, probeName: string): number;
}
//# sourceMappingURL=ProbeScheduler.d.ts.map