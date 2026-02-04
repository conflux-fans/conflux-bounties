export { AlertEngine, type OnAlertCallback } from "./AlertEngine";
export { AlertEvaluator, type EvaluationResult } from "./AlertEvaluator";
export type { IAlertChannel, AlertPayload } from "./channels/IAlertChannel";
export { ConsoleChannel } from "./channels/ConsoleChannel";
export { SlackChannel } from "./channels/SlackChannel";
export { EmailChannel, type SmtpConfig } from "./channels/EmailChannel";
export { WebhookChannel } from "./channels/WebhookChannel";
