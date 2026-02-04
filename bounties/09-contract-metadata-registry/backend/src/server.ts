import Fastify from "fastify";
import cors from "@fastify/cors";
import { loggerConfig } from "./lib/logger";
import { registerRateLimit } from "./middleware/rateLimit";
import { healthRoutes } from "./routes/health";
import { submissionRoutes } from "./routes/submissions";
import { contractRoutes } from "./routes/contracts";
import { adminRoutes } from "./routes/admin";

export async function buildServer() {
  const app = Fastify({ logger: loggerConfig as any });

  // Plugins
  await app.register(cors, { origin: true });
  await registerRateLimit(app);

  // Routes
  await app.register(healthRoutes);
  await app.register(submissionRoutes);
  await app.register(contractRoutes);
  await app.register(adminRoutes);

  return app;
}
