import type { IAlertChannel, AlertPayload } from "./IAlertChannel";
/**
 * Sends alert notifications to a generic webhook URL.
 * Compatible with PagerDuty-style integrations.
 */
export declare class WebhookChannel implements IAlertChannel {
    private readonly webhookUrl;
    readonly name = "webhook";
    private readonly logger;
    constructor(webhookUrl: string);
    send(payload: AlertPayload): Promise<void>;
}
//# sourceMappingURL=WebhookChannel.d.ts.map