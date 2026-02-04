import { env } from "./config/env";
import { buildServer } from "./server";
import { startPinWorker } from "./workers/pin.worker";
import { startVerifyWorker } from "./workers/verify.worker";
import { migrate } from "./db/migrate";

async function main() {
  await migrate();

  const app = await buildServer();

  // Start BullMQ workers (same process)
  const pinWorker = startPinWorker();
  const verifyWorker = startVerifyWorker();

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await pinWorker.close();
    await verifyWorker.close();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start server
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
