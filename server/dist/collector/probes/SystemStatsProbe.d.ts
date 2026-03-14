import type { IProbe, ProbeResult } from "../IProbe";
/**
 * Probes local system stats: CPU usage, memory usage, and disk usage.
 * These metrics are not per-node — they describe the machine running the collector.
 * The nodeId is still attached for consistency in the data model.
 */
export declare class SystemStatsProbe implements IProbe {
    readonly name = "system_stats";
    execute(nodeId: string, _rpcUrl: string, _spaceType: string): Promise<ProbeResult[]>;
}
//# sourceMappingURL=SystemStatsProbe.d.ts.map