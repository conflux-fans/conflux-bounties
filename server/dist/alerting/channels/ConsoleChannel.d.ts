import type { IAlertChannel, AlertPayload } from "./IAlertChannel";
/**
 * Logs alerts to the console via the structured logger.
 * Always available — used as the default/fallback channel.
 */
export declare class ConsoleChannel implements IAlertChannel {
    readonly name = "console";
    private readonly logger;
    send(payload: AlertPayload): Promise<void>;
}
//# sourceMappingURL=ConsoleChannel.d.ts.map