import { Application } from "./Application";
import { Logger } from "./utils/Logger";

const logger = new Logger("Main");

async function main(): Promise<void> {
  const app = new Application();

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
