"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookChannel = void 0;
const Logger_1 = require("../../utils/Logger");
/**
 * Sends alert notifications to a generic webhook URL.
 * Compatible with PagerDuty-style integrations.
 */
class WebhookChannel {
    webhookUrl;
    name = "webhook";
    logger = new Logger_1.Logger("WebhookChannel");
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
    }
    async send(payload) {
        if (!this.webhookUrl) {
            this.logger.warn("Webhook URL not configured, skipping");
            return;
        }
        try {
            const response = await fetch(this.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                throw new Error(`Webhook returned ${response.status}`);
            }
            this.logger.info("Webhook notification sent", { alertId: payload.alertId });
        }
        catch (err) {
            this.logger.error("Failed to send webhook notification", {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}
exports.WebhookChannel = WebhookChannel;
//# sourceMappingURL=WebhookChannel.js.map