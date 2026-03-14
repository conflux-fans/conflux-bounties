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
export declare class EmailChannel implements IAlertChannel {
    private readonly config;
    readonly name = "email";
    private readonly logger;
    private readonly transporter;
    constructor(config: SmtpConfig);
    send(payload: AlertPayload): Promise<void>;
}
//# sourceMappingURL=EmailChannel.d.ts.map