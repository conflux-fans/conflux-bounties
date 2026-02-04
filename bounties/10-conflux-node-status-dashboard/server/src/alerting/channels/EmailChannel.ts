import nodemailer from "nodemailer";
import { Logger } from "../../utils/Logger";
import type { IAlertChannel, AlertPayload } from "./IAlertChannel";

/** SMTP configuration for the email channel */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
}

/**
 * Sends alert notifications via email using nodemailer.
 */
export class EmailChannel implements IAlertChannel {
  readonly name = "email";
  private readonly logger = new Logger("EmailChannel");
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(payload: AlertPayload): Promise<void> {
    if (!this.config.host || !this.config.to) {
      this.logger.warn("SMTP not configured, skipping email alert");
      return;
    }

    const subject = `[${payload.severity.toUpperCase()}] ${payload.ruleName} — ${payload.nodeName}`;

    const html = `
      <h2>${payload.ruleName}</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px;font-weight:bold">Node</td><td>${payload.nodeName}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Severity</td><td>${payload.severity}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Metric</td><td>${payload.metric}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Value</td><td>${payload.value}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Threshold</td><td>${payload.threshold}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Time</td><td>${payload.timestamp}</td></tr>
      </table>
      <p>${payload.message}</p>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: this.config.to,
        subject,
        html,
      });
      this.logger.info("Email alert sent", { alertId: payload.alertId });
    } catch (err) {
      this.logger.error("Failed to send email alert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
