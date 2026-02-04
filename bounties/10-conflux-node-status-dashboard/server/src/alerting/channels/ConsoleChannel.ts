import { Logger } from "../../utils/Logger";
import type { IAlertChannel, AlertPayload } from "./IAlertChannel";

/**
 * Logs alerts to the console via the structured logger.
 * Always available — used as the default/fallback channel.
 */
export class ConsoleChannel implements IAlertChannel {
  readonly name = "console";
  private readonly logger = new Logger("Alert");

  async send(payload: AlertPayload): Promise<void> {
    const logMethod =
      payload.severity === "critical" ? "error" : "warn";

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
