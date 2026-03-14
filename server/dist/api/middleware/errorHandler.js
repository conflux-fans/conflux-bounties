"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const Logger_1 = require("../../utils/Logger");
const logger = new Logger_1.Logger("ErrorHandler");
/**
 * Global Express error handler.
 * Catches thrown errors and returns structured JSON responses.
 */
function errorHandler(err, _req, res, _next) {
    /** Zod validation errors → 400 */
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: "Validation error",
            details: err.errors.map((e) => ({
                path: e.path.join("."),
                message: e.message,
            })),
        });
        return;
    }
    logger.error("Unhandled error", {
        error: err.message,
        stack: err.stack,
    });
    res.status(500).json({ error: "Internal server error" });
}
//# sourceMappingURL=errorHandler.js.map