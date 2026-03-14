import type { IAlertChannel, AlertPayload } from "./IAlertChannel";
/**
 * Sends alert notifications to Slack via an incoming webhook URL.
 * Uses Block Kit formatting for rich messages.
 */
export declare class SlackChannel implements IAlertChannel {
    private readonly webhookUrl;
    readonly name = "slack";
    private readonly logger;
    constructor(webhookUrl: string);
    send(payload: AlertPayload): Promise<void>;
}
//# sourceMappingURL=SlackChannel.d.ts.map