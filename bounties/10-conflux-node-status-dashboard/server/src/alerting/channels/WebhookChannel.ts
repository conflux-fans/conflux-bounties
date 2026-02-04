import { Logger } from "../../utils/Logger";
import type { IAlertChannel, AlertPayload } from "./IAlertChannel";

/**
 * Sends alert notifications to a generic webhook URL.
 * Compatible with PagerDuty-style integrations.
 */
export class WebhookChannel implements IAlertChannel {
  readonly name = "webhook";
  private readonly logger = new Logger("WebhookChannel");

  constructor(private readonly webhookUrl: string) {}

  async send(payload: AlertPayload): Promise<void> {
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
    } catch (err) {
      this.logger.error("Failed to send webhook notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
