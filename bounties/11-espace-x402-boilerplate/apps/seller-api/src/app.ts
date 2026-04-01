import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoute } from "./routes/health.js";
import { dataRoutes } from "./routes/data.js";
import { computeRoutes } from "./routes/compute.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { disputeRoutes } from "./routes/disputes.js";
import { manifestRoutes } from "./routes/manifest.js";
import { adminRoutes } from "./routes/admin.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { serializeMetrics, httpRequestsTotal, httpRequestDuration } from "./lib/metrics.js";

export const app = new Hono();

app.use("*", cors());
app.use("*", requestLogger);
app.use("*", rateLimiter);

// Metrics collection middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const path = c.req.path;
  const method = c.req.method;
  const status = String(c.res.status);
  httpRequestsTotal.inc({ method, path, status });
  httpRequestDuration.observe({ method, path }, duration);
});

// Prometheus metrics endpoint (no auth — scraped by monitoring)
app.get("/metrics", (c) => {
  return new Response(serializeMetrics(), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
});

app.route("/health", healthRoute);
app.route("/data", dataRoutes);
app.route("/compute", computeRoutes);
app.route("/invoices", invoiceRoutes);
app.route("/disputes", disputeRoutes);
app.route("/x402/manifest", manifestRoutes);

// Public agent status check (no auth required — agents need to self-check)
app.get("/agent/:address/status", async (c) => {
  const { sql } = await import("./db/index.js");
  const address = c.req.param("address").toLowerCase();
  const [control] = await sql`SELECT * FROM agent_controls WHERE agent_address = ${address}`;
  return c.json({
    address,
    paused: control?.paused ?? false,
    pausedAt: control?.paused_at ?? null,
    reason: control?.reason ?? null,
  });
});

app.use("/admin/*", adminAuth);
app.route("/admin", adminRoutes);
