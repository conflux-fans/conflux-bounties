"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeRegistry = void 0;
const Logger_1 = require("../utils/Logger");
/**
 * Registry of available probes.
 * Implements the plugin pattern — probes self-register on startup
 * and can be dynamically added without modifying the scheduler.
 */
class ProbeRegistry {
    probes = new Map();
    logger = new Logger_1.Logger("ProbeRegistry");
    /** Register a probe instance */
    register(probe) {
        if (this.probes.has(probe.name)) {
            this.logger.warn(`Probe "${probe.name}" already registered, overwriting`);
        }
        this.probes.set(probe.name, probe);
        this.logger.info(`Registered probe: ${probe.name}`);
    }
    /** Get a probe by name */
    get(name) {
        return this.probes.get(name);
    }
    /** Get all registered probes */
    getAll() {
        return Array.from(this.probes.values());
    }
    /** Get the names of all registered probes */
    names() {
        return Array.from(this.probes.keys());
    }
    /** Check if a probe is registered */
    has(name) {
        return this.probes.has(name);
    }
    /** Unregister a probe by name */
    unregister(name) {
        return this.probes.delete(name);
    }
}
exports.ProbeRegistry = ProbeRegistry;
//# sourceMappingURL=ProbeRegistry.js.map