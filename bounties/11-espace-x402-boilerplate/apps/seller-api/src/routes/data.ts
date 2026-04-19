import { Hono } from "hono";
import { x402Paywall } from "../middleware/x402.js";

export const dataRoutes = new Hono();

// Free endpoint — no payment required
dataRoutes.get("/free", (c) => {
  return c.json({
    data: {
      message: "This is free data available to everyone",
      blockHeight: Math.floor(Math.random() * 1_000_000),
      timestamp: Date.now(),
      metrics: {
        tps: (Math.random() * 100).toFixed(2),
        activeAccounts: Math.floor(Math.random() * 50000),
      },
    },
  });
});

// Instant endpoint — x402 paywall, designed for no-escrow sellers
dataRoutes.get("/instant", x402Paywall, (c) => {
  return c.json({
    data: {
      message: "Instant access data — no escrow hold on this payment",
      lookup: {
        cfxPrice: (Math.random() * 0.5 + 0.1).toFixed(4),
        gasPrice: Math.floor(Math.random() * 30 + 1),
        blockHeight: Math.floor(Math.random() * 1_000_000),
        epoch: Math.floor(Math.random() * 500_000),
        networkStatus: "healthy",
      },
      timestamp: Date.now(),
    },
  });
});

// Premium endpoint — x402 paywall
dataRoutes.get("/premium", x402Paywall, (c) => {
  return c.json({
    data: {
      message: "Premium analytics data — thank you for your payment",
      detailedMetrics: {
        blockHeight: Math.floor(Math.random() * 1_000_000),
        tps: (Math.random() * 100).toFixed(2),
        activeAccounts: Math.floor(Math.random() * 50000),
        gasUsed: (Math.random() * 1e12).toFixed(0),
        topContracts: [
          { address: "0xabc...123", calls: 4521 },
          { address: "0xdef...456", calls: 3210 },
          { address: "0x789...abc", calls: 2101 },
        ],
        historicalTrend: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          txCount: Math.floor(Math.random() * 10000),
        })),
      },
      timestamp: Date.now(),
    },
  });
});
