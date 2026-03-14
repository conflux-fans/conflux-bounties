"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Application_1 = require("./Application");
const Logger_1 = require("./utils/Logger");
const logger = new Logger_1.Logger("Main");
async function main() {
    const app = new Application_1.Application();
    /** Graceful shutdown on SIGINT/SIGTERM */
    const shutdown = async () => {
        await app.stop();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("uncaughtException", (err) => {
        logger.error("Uncaught exception", { error: err.message, stack: err.stack });
        process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
        logger.error("Unhandled rejection", {
            error: reason instanceof Error ? reason.message : String(reason),
        });
    });
    await app.start();
}
main().catch((err) => {
    logger.error("Failed to start application", {
        error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
});
//# sourceMappingURL=index.js.map