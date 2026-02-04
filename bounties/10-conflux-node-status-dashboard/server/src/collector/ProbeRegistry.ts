import type { IProbe } from "./IProbe";
import { Logger } from "../utils/Logger";

/**
 * Registry of available probes.
 * Implements the plugin pattern — probes self-register on startup
 * and can be dynamically added without modifying the scheduler.
 */
export class ProbeRegistry {
  private readonly probes = new Map<string, IProbe>();
  private readonly logger = new Logger("ProbeRegistry");

  /** Register a probe instance */
  register(probe: IProbe): void {
    if (this.probes.has(probe.name)) {
      this.logger.warn(`Probe "${probe.name}" already registered, overwriting`);
    }
    this.probes.set(probe.name, probe);
    this.logger.info(`Registered probe: ${probe.name}`);
  }

  /** Get a probe by name */
  get(name: string): IProbe | undefined {
    return this.probes.get(name);
  }

  /** Get all registered probes */
  getAll(): IProbe[] {
    return Array.from(this.probes.values());
  }

  /** Get the names of all registered probes */
  names(): string[] {
    return Array.from(this.probes.keys());
  }

  /** Check if a probe is registered */
  has(name: string): boolean {
    return this.probes.has(name);
  }

  /** Unregister a probe by name */
  unregister(name: string): boolean {
    return this.probes.delete(name);
  }
}
