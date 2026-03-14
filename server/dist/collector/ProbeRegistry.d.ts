import type { IProbe } from "./IProbe";
/**
 * Registry of available probes.
 * Implements the plugin pattern — probes self-register on startup
 * and can be dynamically added without modifying the scheduler.
 */
export declare class ProbeRegistry {
    private readonly probes;
    private readonly logger;
    /** Register a probe instance */
    register(probe: IProbe): void;
    /** Get a probe by name */
    get(name: string): IProbe | undefined;
    /** Get all registered probes */
    getAll(): IProbe[];
    /** Get the names of all registered probes */
    names(): string[];
    /** Check if a probe is registered */
    has(name: string): boolean;
    /** Unregister a probe by name */
    unregister(name: string): boolean;
}
//# sourceMappingURL=ProbeRegistry.d.ts.map