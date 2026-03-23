/**
 * Result from a single probe execution.
 * Each probe can return multiple metric points per run.
 */
export interface ProbeResult {
  nodeId: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: number;
}

/**
 * Interface for all metric probes.
 * Probes are the plugin units of the collector system.
 */
export interface IProbe {
  /** Unique name identifying this probe */
  readonly name: string;

  /** Execute the probe and return metric data points */
  execute(nodeId: string, rpcUrl: string, spaceType: string): Promise<ProbeResult[]>;
}
