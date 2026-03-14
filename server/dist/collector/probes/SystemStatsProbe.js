"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemStatsProbe = void 0;
const systeminformation_1 = __importDefault(require("systeminformation"));
/**
 * Probes local system stats: CPU usage, memory usage, and disk usage.
 * These metrics are not per-node — they describe the machine running the collector.
 * The nodeId is still attached for consistency in the data model.
 */
class SystemStatsProbe {
    name = "system_stats";
    async execute(nodeId, _rpcUrl, _spaceType) {
        const [cpu, mem, disk] = await Promise.all([
            systeminformation_1.default.currentLoad(),
            systeminformation_1.default.mem(),
            systeminformation_1.default.fsSize(),
        ]);
        const now = Date.now();
        const results = [
            {
                nodeId,
                metricName: "cpu_usage",
                value: Math.round(cpu.currentLoad * 100) / 100,
                unit: "%",
                timestamp: now,
            },
            {
                nodeId,
                metricName: "memory_usage",
                value: Math.round((mem.used / mem.total) * 10000) / 100,
                unit: "%",
                timestamp: now,
            },
            {
                nodeId,
                metricName: "memory_used_gb",
                value: Math.round((mem.used / 1073741824) * 100) / 100,
                unit: "GB",
                timestamp: now,
            },
            {
                nodeId,
                metricName: "memory_total_gb",
                value: Math.round((mem.total / 1073741824) * 100) / 100,
                unit: "GB",
                timestamp: now,
            },
        ];
        /** Add disk usage for the primary filesystem */
        if (disk.length > 0) {
            const primary = disk[0];
            results.push({
                nodeId,
                metricName: "disk_usage",
                value: Math.round(primary.use * 100) / 100,
                unit: "%",
                timestamp: now,
            });
        }
        return results;
    }
}
exports.SystemStatsProbe = SystemStatsProbe;
//# sourceMappingURL=SystemStatsProbe.js.map