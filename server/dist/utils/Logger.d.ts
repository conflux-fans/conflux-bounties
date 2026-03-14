/**
 * Lightweight structured logger.
 * Outputs JSON in production, pretty-printed in development.
 */
export declare class Logger {
    private readonly context;
    constructor(context: string);
    /** Log an informational message */
    info(message: string, data?: Record<string, unknown>): void;
    /** Log a warning message */
    warn(message: string, data?: Record<string, unknown>): void;
    /** Log an error message */
    error(message: string, data?: Record<string, unknown>): void;
    /** Log a debug message (only in development) */
    debug(message: string, data?: Record<string, unknown>): void;
    private log;
}
//# sourceMappingURL=Logger.d.ts.map