"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Lightweight structured logger.
 * Outputs JSON in production, pretty-printed in development.
 */
class Logger {
    context;
    constructor(context) {
        this.context = context;
    }
    /** Log an informational message */
    info(message, data) {
        this.log("INFO", message, data);
    }
    /** Log a warning message */
    warn(message, data) {
        this.log("WARN", message, data);
    }
    /** Log an error message */
    error(message, data) {
        this.log("ERROR", message, data);
    }
    /** Log a debug message (only in development) */
    debug(message, data) {
        if (process.env.NODE_ENV !== "production") {
            this.log("DEBUG", message, data);
        }
    }
    log(level, message, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            message,
            ...data,
        };
        const output = JSON.stringify(entry);
        if (level === "ERROR") {
            console.error(output);
        }
        else if (level === "WARN") {
            console.warn(output);
        }
        else {
            console.log(output);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map