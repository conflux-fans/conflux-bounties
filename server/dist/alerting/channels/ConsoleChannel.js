"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleChannel = void 0;
const Logger_1 = require("../../utils/Logger");
/**
 * Logs alerts to the console via the structured logger.
 * Always available — used as the default/fallback channel.
 */
class ConsoleChannel {
    name = "console";
    logger = new Logger_1.Logger("Alert");
    async send(payload) {
        const logMethod = payload.severity === "critical" ? "error" : "warn";
        this.logger[logMethod](`[${payload.severity.toUpperCase()}] ${payload.message}`, {
            alertId: payload.alertId,
            nodeId: payload.nodeId,
            nodeName: payload.nodeName,
            metric: payload.metric,
            value: payload.value,
            threshold: payload.threshold,
        });
    }
}
exports.ConsoleChannel = ConsoleChannel;
//# sourceMappingURL=ConsoleChannel.js.map