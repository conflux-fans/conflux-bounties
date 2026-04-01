import { Hono } from "hono";
import { x402Paywall } from "../middleware/x402.js";

export const computeRoutes = new Hono();

computeRoutes.post("/simulate", x402Paywall, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const iterations = Math.min(body.iterations || 1000, 10000);

  // Simulate a compute-heavy task
  const results = Array.from({ length: iterations }, (_, i) => ({
    step: i,
    value: Math.sin(i * 0.01) * Math.cos(i * 0.02) * 100,
  }));

  const summary = {
    min: Math.min(...results.map((r) => r.value)),
    max: Math.max(...results.map((r) => r.value)),
    mean: results.reduce((s, r) => s + r.value, 0) / results.length,
    iterations,
  };

  return c.json({
    data: {
      message: "Simulation complete",
      summary,
      sampleResults: results.slice(0, 10),
      timestamp: Date.now(),
    },
  });
});
