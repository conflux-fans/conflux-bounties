"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackChannel = void 0;
const Logger_1 = require("../../utils/Logger");
/**
 * Sends alert notifications to Slack via an incoming webhook URL.
 * Uses Block Kit formatting for rich messages.
 */
class SlackChannel {
    webhookUrl;
    name = "slack";
    logger = new Logger_1.Logger("SlackChannel");
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
    }
    async send(payload) {
        if (!this.webhookUrl) {
            this.logger.warn("Slack webhook URL not configured, skipping");
            return;
        }
        const severityEmoji = payload.severity === "critical" ? ":rotating_light:" : ":warning:";
        const body = {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `${severityEmoji} ${payload.ruleName}`,
                    },
                },
                {
                    type: "section",
                    fields: [
                        { type: "mrkdwn", text: `*Node:*\n${payload.nodeName}` },
                        { type: "mrkdwn", text: `*Severity:*\n${payload.severity}` },
                        { type: "mrkdwn", text: `*Metric:*\n${payload.metric}` },
                        { type: "mrkdwn", text: `*Value:*\n${payload.value}` },
                        { type: "mrkdwn", text: `*Threshold:*\n${payload.threshold}` },
                        { type: "mrkdwn", text: `*Time:*\n${payload.timestamp}` },
                    ],
                },
                {
                    type: "section",
                    text: { type: "mrkdwn", text: payload.message },
                },
            ],
        };
        try {
            const response = await fetch(this.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(`Slack webhook returned ${response.status}`);
            }
            this.logger.info("Slack notification sent", { alertId: payload.alertId });
        }
        catch (err) {
            this.logger.error("Failed to send Slack notification", {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}
exports.SlackChannel = SlackChannel;
//# sourceMappingURL=SlackChannel.js.map