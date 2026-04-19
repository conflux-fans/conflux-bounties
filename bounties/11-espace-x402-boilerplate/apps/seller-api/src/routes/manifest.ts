import { Hono } from "hono";
import { sql } from "../db/index.js";
import { config } from "../lib/config.js";
import { TOKEN_DECIMALS, USDT0_MAINNET, CNHT0_MAINNET } from "@x402/shared";

export const manifestRoutes = new Hono();

/**
 * x402 API Manifest — auto-generated from endpoint pricing config.
 *
 * Any x402-compatible API serves this at /x402/manifest so buyers
 * (and the SellerDirectory) can discover endpoints, methods, pricing,
 * and required parameters without out-of-band docs.
 */

// Static endpoint metadata that enriches the DB pricing rows.
const ENDPOINT_META: Record<string, { path: string; method: string; description: string; params?: Record<string, string>; returns?: string }> = {
  "/data/free": {
    path: "/data/free",
    method: "GET",
    description: "Basic network metrics including TPS and active accounts",
    returns: "JSON { data: { blockHeight, timestamp, metrics: { tps, activeAccounts } } }",
  },
  "/data/instant": {
    path: "/data/instant",
    method: "GET",
    description: "Quick price and network lookup — cheap, designed for no-escrow sellers",
    returns: "JSON { data: { lookup: { cfxPrice, gasPrice, blockHeight, epoch, networkStatus }, timestamp } }",
  },
  "/data/premium": {
    path: "/data/premium",
    method: "GET",
    description: "Detailed analytics with historical trends, top contracts, and gas usage",
    returns: "JSON { data: { detailedMetrics: { blockHeight, tps, activeAccounts, gasUsed, topContracts, historicalTrend }, timestamp } }",
  },
  "/compute/simulate": {
    path: "/compute/simulate",
    method: "POST",
    description: "Run a compute simulation with configurable iterations",
    params: { iterations: "number (1-10000, default 1000)" },
    returns: "JSON { data: { summary: { min, max, mean, iterations }, sampleResults, timestamp } }",
  },
};

// Fallback pricing when DB is unavailable
const FALLBACK_PRICING = [
  { endpoint: "/data/instant", price: "10000", tier: "premium", description: "", token: "" },
  { endpoint: "/data/premium", price: "100000", tier: "premium", description: "", token: "" },
  { endpoint: "/compute/simulate", price: "500000", tier: "premium", description: "", token: "" },
];

// Multi-token pricing (CNHT0 at ~7.2x USDT0 rate)
const CNHT0_MULTIPLIER = 7.2;

manifestRoutes.get("/", async (c) => {
  // Try DB pricing, fall back to hardcoded defaults
  let pricing: { endpoint: string; price: string; tier: string; description: string; token?: string }[];
  try {
    pricing = await sql`SELECT endpoint, price, tier, description, token FROM endpoint_pricing ORDER BY endpoint`;
  } catch {
    pricing = FALLBACK_PRICING;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endpoints: any[] = [];

  // Add free endpoints (not in pricing table)
  for (const [path, meta] of Object.entries(ENDPOINT_META)) {
    const pricingRow = pricing.find((p) => p.endpoint === path);
    if (!pricingRow) {
      endpoints.push({
        ...meta,
        tier: "free",
        price: "Free",
        priceRaw: "0",
      });
    }
  }

  // Add priced endpoints with multi-token pricing
  for (const row of pricing) {
    const meta = ENDPOINT_META[row.endpoint];
    const humanPrice = (Number(row.price) / 10 ** TOKEN_DECIMALS).toFixed(2);

    // Build per-token pricing
    const tokenPricing: { token: string; symbol: string; price: string; priceRaw: string }[] = [
      { token: config.tokenAddress.toLowerCase(), symbol: "USDT0", price: `${humanPrice} USDT0`, priceRaw: String(row.price) },
    ];

    // Add CNHT0 pricing on mainnet
    if (!config.isTestnet) {
      const cnhtPrice = Math.round(Number(row.price) * CNHT0_MULTIPLIER);
      const cnhtHuman = (cnhtPrice / 10 ** TOKEN_DECIMALS).toFixed(2);
      tokenPricing.push({
        token: CNHT0_MAINNET.toLowerCase(),
        symbol: "CNHT0",
        price: `${cnhtHuman} CNHT0`,
        priceRaw: String(cnhtPrice),
      });
    }

    endpoints.push({
      path: row.endpoint,
      method: meta?.method || "GET",
      tier: (row.tier as "free" | "premium") || "premium",
      price: `${humanPrice} USDT0`,
      priceRaw: String(row.price),
      description: meta?.description || row.description || "",
      ...(meta?.params && { params: meta.params }),
      ...(meta?.returns && { returns: meta.returns }),
      tokenPricing,
    });
  }

  // Supported tokens
  const supportedTokens: { address: string; symbol: string; decimals: number }[] = [
    { address: config.tokenAddress, symbol: "USDT0", decimals: TOKEN_DECIMALS },
  ];
  if (!config.isTestnet) {
    supportedTokens.push({ address: CNHT0_MAINNET, symbol: "CNHT0", decimals: TOKEN_DECIMALS });
  }

  return c.json({
    name: "x402 Boilerplate API",
    version: "1.0",
    network: {
      name: config.isTestnet ? "Conflux eSpace Testnet" : "Conflux eSpace",
      chainId: config.chainId,
    },
    payment: {
      token: config.tokenAddress,
      tokenSymbol: "USDT0",
      tokenDecimals: TOKEN_DECIMALS,
      facilitator: config.contractAddress,
      seller: config.serviceWalletAddress,
      supportedTokens,
    },
    endpoints,
  });
});
