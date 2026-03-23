/**
 * Payload sent to alert notification channels.
 */
export interface AlertPayload {
  alertId: string;
  ruleName: string;
  nodeId: string;
  nodeName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  timestamp: string;
}

/**
 * Interface for alert notification channels.
 * Each channel (Slack, email, webhook, console) implements this.
 */
export interface IAlertChannel {
  /** Unique name of this channel type */
  readonly name: string;

  /** Send an alert notification */
  send(payload: AlertPayload): Promise<void>;
}
