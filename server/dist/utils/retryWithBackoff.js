"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryWithBackoff = retryWithBackoff;
const Logger_1 = require("./Logger");
const logger = new Logger_1.Logger("retry");
/**
 * Retry an async function with exponential backoff and jitter.
 * Throws the last error if all attempts fail.
 */
async function retryWithBackoff(fn, options = {}) {
    const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 30_000 } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt === maxAttempts) {
                break;
            }
            /** Exponential delay with jitter */
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500, maxDelayMs);
            logger.warn(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`, {
                error: lastError.message,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
//# sourceMappingURL=retryWithBackoff.js.map