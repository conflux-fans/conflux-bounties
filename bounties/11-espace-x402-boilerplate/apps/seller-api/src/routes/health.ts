import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "x402-seller-api",
    timestamp: new Date().toISOString(),
  });
});
