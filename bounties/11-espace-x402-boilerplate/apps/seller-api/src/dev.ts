/**
 * Standalone dev server that runs WITHOUT Postgres/Redis.
 * Uses in-memory storage for invoices, pricing, and logs.
 * Implements x402 with ERC-3009 (receiveWithAuthorization) payment flow.
 *
 * Multi-tenant: the contract accepts any recipient — this seller's wallet
 * is specified in the 402 challenge and locked into the buyer's signature.
 *
 * Start with: npx tsx apps/seller-api/src/dev.ts
 */
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the monorepo root (3 levels up from apps/seller-api/src/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { v4 as uuidv4 } from "uuid";
import {
  buildPaymentHeaders,
  DEFAULT_PAYMENT_TOKEN,
  INVOICE_EXPIRY_SECONDS,
  TOKEN_DECIMALS,
  hashNonce,
  getERC3009Domain,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
} from "@x402/shared";
import { verifyTypedData } from "viem";

import { X402Verifier, confluxESpaceTestnet, confluxESpaceMainnet } from "@x402/sdk";
import { USDT0_MAINNET, CNHT0_MAINNET } from "@x402/shared";
// Dynamically imported after dotenv loads (ES module hoisting would otherwise
// cause config.ts to read process.env before dotenv runs).
const { adminAuthRoutes } = await import("./routes/adminAuth.js");
const { adminAuth } = await import("./middleware/adminAuth.js");

const SERVICE_WALLET = process.env.SERVICE_WALLET_ADDRESS || "0xFF1D35e04d9F336283046fA464Be11B675B0e5aF";
// All endpoints use the same seller wallet
const FACILITATOR_KEY = process.env.SERVICE_WALLET_KEY as `0x${string}` | undefined;

// ─── Per-network configuration ───
interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  tokenAddress: string;
  contractAddress?: `0x${string}`;
  cnht0Address?: string;
}

const NETWORKS: Record<number, NetworkConfig> = {
  71: {
    chainId: 71,
    name: "Conflux eSpace Testnet",
    rpcUrl: "https://evmtestnet.confluxrpc.com",
    tokenAddress: process.env.USDT0_ADDRESS_TESTNET || "",
    contractAddress: (process.env.X402_CONTRACT_ADDRESS_TESTNET || process.env.X402_CONTRACT_ADDRESS || undefined) as `0x${string}` | undefined,
  },
  1030: {
    chainId: 1030,
    name: "Conflux eSpace",
    rpcUrl: "https://evm.confluxrpc.com",
    tokenAddress: process.env.USDT0_ADDRESS_MAINNET || USDT0_MAINNET,
    contractAddress: (process.env.X402_CONTRACT_ADDRESS_MAINNET || undefined) as `0x${string}` | undefined,
    cnht0Address: process.env.CNHT0_ADDRESS || CNHT0_MAINNET,
  },
};

// Default network from env (fallback for requests without x-chain-id header)
const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID) || 71;

// Backwards compat — TOKEN_ADDRESS and CONTRACT_ADDRESS default to the env-configured network
const TOKEN_ADDRESS = NETWORKS[DEFAULT_CHAIN_ID]?.tokenAddress || DEFAULT_PAYMENT_TOKEN;
const CONTRACT_ADDRESS = NETWORKS[DEFAULT_CHAIN_ID]?.contractAddress;

// Create verifiers for each network that has a contract address + facilitator key
const verifiers: Record<number, X402Verifier> = {};
if (FACILITATOR_KEY) {
  for (const [chainIdStr, net] of Object.entries(NETWORKS)) {
    if (net.contractAddress) {
      const chainId = Number(chainIdStr);
      verifiers[chainId] = new X402Verifier({
        contractAddress: net.contractAddress,
        rpcUrl: net.rpcUrl,
        chain: chainId === 1030 ? confluxESpaceMainnet : confluxESpaceTestnet,
        facilitatorKey: FACILITATOR_KEY,
      });
    }
  }
}
// Default verifier for backwards compat
const verifier = verifiers[DEFAULT_CHAIN_ID] || null;

/** Resolve chain ID from request header, falling back to env default */
function resolveChainId(c: any): number {
  const header = c.req.header("x-chain-id");
  if (header) {
    const id = Number(header);
    if (NETWORKS[id]) return id;
  }
  return DEFAULT_CHAIN_ID;
}

/** Get network config for a request */
function resolveNetwork(c: any): NetworkConfig {
  return NETWORKS[resolveChainId(c)] || NETWORKS[DEFAULT_CHAIN_ID];
}

/** Enrich an invoice with live escrow timing fields. */
function withEscrowTiming(inv: Record<string, unknown>) {
  if (inv.status === "paid" && inv.release_at) {
    const releaseAt = new Date(inv.release_at as string).getTime();
    const now = Date.now();
    return {
      ...inv,
      escrow_remaining_ms: Math.max(0, releaseAt - now),
      escrow_released: now >= releaseAt,
    };
  }
  return inv;
}

const app = new Hono();
app.use("*", cors({
  origin: "*",
  exposeHeaders: [
    "x-payment-amount", "x-payment-token", "x-payment-nonce", "x-payment-expiry",
    "x-payment-endpoint", "x-payment-invoice-id", "x-payment-description",
    "x-payment-recipient", "x-payment-verifier",
  ],
}));

// ─── In-memory state ───
const invoices = new Map<string, Record<string, unknown>>();
// CNHT0 address (mainnet only — CNY stablecoin)
const CNHT0_ADDRESS = NETWORKS[1030]?.cnht0Address || "0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e";

/** Build pricing map for a given chain */
function getPricing(chainId: number) {
  const net = NETWORKS[chainId] || NETWORKS[DEFAULT_CHAIN_ID];
  return new Map<string, { price: string; token: string; description: string; tier: string; escrow_duration: number }>([
    ["/data/instant", { price: "10000", token: net.tokenAddress, description: "Quick price and network lookup (0.01 USDT0)", tier: "premium", escrow_duration: 0 }],
    ["/data/premium", { price: "100000", token: net.tokenAddress, description: "Premium data feed (0.10 USDT0)", tier: "premium", escrow_duration: 3600 }],
    ["/compute/simulate", { price: "500000", token: net.tokenAddress, description: "Compute simulation (0.50 USDT0)", tier: "premium", escrow_duration: 86400 }],
  ]);
}

/** Build token pricing map for a given chain */
function getTokenPricing(chainId: number) {
  const net = NETWORKS[chainId] || NETWORKS[DEFAULT_CHAIN_ID];
  const isMainnetChain = chainId === 1030;
  return new Map<string, Map<string, { price: string; symbol: string }>>([
    ["/data/instant", new Map([
      [net.tokenAddress.toLowerCase(), { price: "10000", symbol: "USDT0" }],
      ...(isMainnetChain && net.cnht0Address ? [[net.cnht0Address.toLowerCase(), { price: "72000", symbol: "CNHT0" }] as const] : []),
    ])],
    ["/data/premium", new Map([
      [net.tokenAddress.toLowerCase(), { price: "100000", symbol: "USDT0" }],
      ...(isMainnetChain && net.cnht0Address ? [[net.cnht0Address.toLowerCase(), { price: "720000", symbol: "CNHT0" }] as const] : []),
    ])],
    ["/compute/simulate", new Map([
      [net.tokenAddress.toLowerCase(), { price: "500000", symbol: "USDT0" }],
      ...(isMainnetChain && net.cnht0Address ? [[net.cnht0Address.toLowerCase(), { price: "3600000", symbol: "CNHT0" }] as const] : []),
    ])],
  ]);
}

// Default pricing (backwards compat for routes that don't pass chain context)
const pricing = getPricing(DEFAULT_CHAIN_ID);
const tokenPricing = getTokenPricing(DEFAULT_CHAIN_ID);
const isMainnet = DEFAULT_CHAIN_ID === 1030;

// ─── Health ───
app.get("/health", (c) =>
  c.json({ status: "ok", service: "x402-seller-api (dev)", timestamp: new Date().toISOString(), paymentMethod: "ERC-3009 (receiveWithAuthorization)", token: TOKEN_ADDRESS, multiTenant: true })
);

// ─── x402 Manifest (auto-discovery for buyers) ───
app.get("/x402/manifest", (c: any) => {
  const chainId = resolveChainId(c);
  const net = resolveNetwork(c);
  const netPricing = getPricing(chainId);
  const netTokenPricing = getTokenPricing(chainId);
  const netIsMainnet = chainId === 1030;
  const endpointMeta: Record<string, { method: string; description: string; params?: Record<string, string>; returns?: string }> = {
    "/data/free": {
      method: "GET",
      description: "Basic network metrics including TPS and active accounts",
      returns: "JSON { data: { blockHeight, timestamp, metrics: { tps, activeAccounts } } }",
    },
    "/data/instant": {
      method: "GET",
      description: "Quick price and network lookup, designed for no-escrow sellers",
      returns: "JSON { data: { lookup: { cfxPrice, gasPrice, blockHeight, epoch, networkStatus }, timestamp } }",
    },
    "/data/premium": {
      method: "GET",
      description: "Detailed analytics with historical trends, top contracts, and gas usage",
      returns: "JSON { data: { detailedMetrics: { blockHeight, tps, activeAccounts, gasUsed, topContracts, historicalTrend }, timestamp } }",
    },
    "/compute/simulate": {
      method: "POST",
      description: "Run a compute simulation with configurable iterations",
      params: { iterations: "number (1-10000, default 1000)" },
      returns: "JSON { data: { summary: { min, max, mean, iterations }, sampleResults, timestamp } }",
    },
  };

  const endpoints = [];

  // Free endpoints (not in pricing map)
  for (const [path, meta] of Object.entries(endpointMeta)) {
    if (!netPricing.has(path)) {
      endpoints.push({ path, ...meta, tier: "free", price: "Free", priceRaw: "0" });
    }
  }

  // Priced endpoints
  for (const [path, p] of netPricing.entries()) {
    const meta = endpointMeta[path];
    const humanPrice = (Number(p.price) / 10 ** TOKEN_DECIMALS).toFixed(2);

    // Build per-token pricing array
    const tokenPrices: { token: string; symbol: string; price: string; priceRaw: string }[] = [];
    const tp = netTokenPricing.get(path);
    if (tp) {
      for (const [addr, info] of tp.entries()) {
        const human = (Number(info.price) / 10 ** TOKEN_DECIMALS).toFixed(2);
        tokenPrices.push({ token: addr, symbol: info.symbol, price: `${human} ${info.symbol}`, priceRaw: info.price });
      }
    }

    endpoints.push({
      path,
      method: meta?.method || "GET",
      tier: p.tier || "premium",
      price: `${humanPrice} USDT0`,
      priceRaw: p.price,
      description: meta?.description || p.description || "",
      ...(meta?.params && { params: meta.params }),
      ...(meta?.returns && { returns: meta.returns }),
      ...(tokenPrices.length > 0 && { tokenPricing: tokenPrices }),
    });
  }

  // Build supported tokens list
  const supportedTokens: { address: string; symbol: string; decimals: number }[] = [
    { address: net.tokenAddress, symbol: "USDT0", decimals: TOKEN_DECIMALS },
  ];
  if (netIsMainnet && net.cnht0Address) {
    supportedTokens.push({ address: net.cnht0Address, symbol: "CNHT0", decimals: TOKEN_DECIMALS });
  }

  return c.json({
    name: "x402 Boilerplate API",
    version: "1.0",
    network: {
      name: net.name,
      chainId: net.chainId,
    },
    payment: {
      token: net.tokenAddress,
      tokenSymbol: "USDT0",
      tokenDecimals: TOKEN_DECIMALS,
      facilitator: net.contractAddress || "",
      seller: SERVICE_WALLET,
      supportedTokens,
    },
    endpoints,
  });
});

// ─── Free data ───
app.get("/data/free", (c) =>
  c.json({
    data: {
      message: "This is free data available to everyone",
      blockHeight: Math.floor(Math.random() * 1_000_000),
      timestamp: Date.now(),
      metrics: { tps: (Math.random() * 100).toFixed(2), activeAccounts: Math.floor(Math.random() * 50000) },
    },
  })
);

// ─── Instant data (low-cost, no escrow) ───
app.get("/data/instant", (c) => {
  const blocked = paywall("/data/instant", c);
  if (blocked) return blocked;
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

// ─── x402 paywall helper ───
function paywall(endpoint: string, c: any) {
  const chainId = resolveChainId(c);
  const net = NETWORKS[chainId] || NETWORKS[DEFAULT_CHAIN_ID];
  const netPricing = getPricing(chainId);
  const netTokenPricing = getTokenPricing(chainId);
  const netIsMainnet = chainId === 1030;

  const p = netPricing.get(endpoint);
  if (!p) return null; // free

  const invoiceId = c.req.header("x-payment-invoice-id");
  if (invoiceId) {
    const inv = invoices.get(invoiceId);
    if (inv && inv.status === "paid") return null; // paid, pass through
  }

  // Allow buyer to request a specific token via header (multi-token support)
  const requestedToken = c.req.header("x-preferred-token")?.toLowerCase();
  let invoiceToken = p.token;
  let invoiceAmount = p.price;
  let invoiceSymbol = "USDT0";

  if (requestedToken && netIsMainnet) {
    const tp = netTokenPricing.get(endpoint);
    if (tp) {
      const tokenInfo = tp.get(requestedToken);
      if (tokenInfo) {
        invoiceToken = requestedToken;
        invoiceAmount = tokenInfo.price;
        invoiceSymbol = tokenInfo.symbol;
      }
    }
  }

  // Build supported tokens list for the 402 response
  const supportedTokensList: { address: string; symbol: string; price: string; priceRaw: string }[] = [];
  const tp = netTokenPricing.get(endpoint);
  if (tp) {
    for (const [addr, info] of tp.entries()) {
      const human = (Number(info.price) / 10 ** TOKEN_DECIMALS).toFixed(2);
      supportedTokensList.push({ address: addr, symbol: info.symbol, price: `${human} ${info.symbol}`, priceRaw: info.price });
    }
  }

  // Issue 402 challenge with ERC-3009 payment details
  const newInvoiceId = uuidv4();
  const nonce = newInvoiceId;
  const expiry = Math.floor(Date.now() / 1000) + INVOICE_EXPIRY_SECONDS;

  const invoiceRecipient = SERVICE_WALLET;

  invoices.set(newInvoiceId, {
    id: newInvoiceId, endpoint, amount: invoiceAmount, token: invoiceToken,
    chainId, nonce, expiry, status: "pending", created_at: new Date().toISOString(),
    recipient: invoiceRecipient,
    escrow_duration: p.escrow_duration,
  });
  const headers = buildPaymentHeaders({
    amount: invoiceAmount, token: invoiceToken, nonce, expiry, endpoint,
    invoiceId: newInvoiceId, description: p.description,
    recipient: invoiceRecipient,
    verifierAddress: net.contractAddress,
  });

  const humanAmount = (Number(invoiceAmount) / 10 ** TOKEN_DECIMALS).toFixed(2);
  return c.json(
    {
      error: "Payment Required",
      message: `This endpoint requires payment of ${humanAmount} ${invoiceSymbol}. Sign an ERC-3009 receiveWithAuthorization and submit to /invoices/${newInvoiceId}/settle`,
      invoiceId: newInvoiceId,
      paymentMethod: "ERC-3009",
      chainId,
      ...(supportedTokensList.length > 1 && { supportedTokens: supportedTokensList }),
      ...headers,
    },
    402,
    headers
  );
}

// ─── Premium data ───
app.get("/data/premium", (c) => {
  const blocked = paywall("/data/premium", c);
  if (blocked) return blocked;
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
        ],
        historicalTrend: Array.from({ length: 24 }, (_, i) => ({
          hour: i, txCount: Math.floor(Math.random() * 10000),
        })),
      },
      timestamp: Date.now(),
    },
  });
});

// ─── Compute simulate ───
app.post("/compute/simulate", async (c) => {
  const blocked = paywall("/compute/simulate", c);
  if (blocked) return blocked;
  const body = await c.req.json().catch(() => ({}));
  const iterations = Math.min(body.iterations || 1000, 10000);
  const results = Array.from({ length: iterations }, (_, i) => ({
    step: i, value: Math.sin(i * 0.01) * Math.cos(i * 0.02) * 100,
  }));
  const vals = results.map((r) => r.value);
  return c.json({
    data: {
      message: "Simulation complete",
      summary: { min: Math.min(...vals), max: Math.max(...vals), mean: vals.reduce((a, b) => a + b, 0) / vals.length, iterations },
      sampleResults: results.slice(0, 10),
      timestamp: Date.now(),
    },
  });
});

// ─── Invoices ───
app.get("/invoices", (c) => {
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  let list = Array.from(invoices.values());
  if (status) list = list.filter((i) => i.status === status);
  list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const enriched = list.slice(0, limit).map(withEscrowTiming);
  return c.json({ invoices: enriched, count: enriched.length });
});

app.get("/invoices/:id", (c) => {
  const inv = invoices.get(c.req.param("id"));
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ invoice: withEscrowTiming(inv) });
});

app.post("/invoices/:id/verify", async (c) => {
  const id = c.req.param("id");
  const inv = invoices.get(id);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  if (inv.status === "paid") return c.json({ invoice: inv, verified: true });

  // Check on-chain if verifier is available and we have the on-chain invoiceId
  const onChainId = inv.onchain_invoice_id as `0x${string}` | undefined;
  if (verifier && onChainId) {
    try {
      const { valid, payer } = await verifier.isInvoicePaid(
        onChainId,
        BigInt(inv.amount as string),
        inv.endpoint as string
      );
      if (valid) {
        const paidAt = new Date().toISOString();
        // Read actual on-chain releaseAt (reflects seller's registered escrow duration)
        let releaseAt: string;
        try {
          const payment = await verifier.getPayment(onChainId);
          releaseAt = new Date(Number(payment.releaseAt) * 1000).toISOString();
        } catch {
          releaseAt = paidAt;
        }
        inv.status = "paid";
        inv.payer = payer;
        inv.paid_at = paidAt;
        inv.release_at = releaseAt;
        return c.json({ invoice: inv, verified: true });
      }
    } catch (err) {
      console.error(`  On-chain verify failed for ${id}:`, err);
    }
  }

  return c.json({ invoice: inv, verified: false });
});

/**
 * Settle endpoint: accepts a signed ERC-3009 authorization from the buyer.
 * Calls X402PaymentVerifier.settle() on-chain via the facilitator wallet.
 * Multi-tenant: the buyer signs ReceiveWithAuthorization with `to` = verifier contract.
 */
app.post("/invoices/:id/settle", async (c) => {
  const id = c.req.param("id");
  const inv = invoices.get(id);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  if (inv.status === "paid") return c.json({ invoice: inv, verified: true, txHash: inv.tx_hash });

  const body = await c.req.json().catch(() => ({}));
  const auth = body.authorization;
  if (!auth || !auth.from || !auth.to || !auth.v || !auth.r || !auth.s) {
    return c.json({ error: "Missing ERC-3009 signed authorization. Expected { authorization: { from, to, value, validAfter, validBefore, nonce, v, r, s } }" }, 400);
  }

  // Validate authorization value matches invoice amount
  if (BigInt(auth.value) < BigInt(inv.amount as string)) {
    return c.json({ error: "Authorization value too low" }, 400);
  }

  // Check expiry
  if (Date.now() / 1000 > Number(inv.expiry)) {
    inv.status = "expired";
    return c.json({ error: "Invoice expired" }, 410);
  }

  // ARCH-1: Verify nonce is derived from this invoiceId
  const expectedNonce = hashNonce(id);
  if (auth.nonce !== expectedNonce) {
    return c.json({ error: "Authorization nonce does not match invoice — signature is not bound to this invoice" }, 400);
  }

  // ARCH-2: Pre-validate EIP-712 signature off-chain before spending gas
  try {
    const CHAIN_ID = (inv.chainId as number) || Number(process.env.CHAIN_ID) || 71;
    const invoiceToken = (inv.token as string) || TOKEN_ADDRESS;
    const tokenDomain = getERC3009Domain(invoiceToken);
    const valid = await verifyTypedData({
      address: auth.from as `0x${string}`,
      domain: {
        name: tokenDomain.name,
        version: tokenDomain.version,
        chainId: BigInt(CHAIN_ID),
        verifyingContract: invoiceToken as `0x${string}`,
      },
      types: RECEIVE_WITH_AUTHORIZATION_TYPES,
      primaryType: "ReceiveWithAuthorization",
      message: {
        from: auth.from as `0x${string}`,
        to: auth.to as `0x${string}`,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter ?? 0),
        validBefore: BigInt(auth.validBefore ?? inv.expiry),
        nonce: auth.nonce as `0x${string}`,
      },
      signature: `0x${Buffer.from([
        ...Buffer.from((auth.r as string).slice(2), "hex"),
        ...Buffer.from((auth.s as string).slice(2), "hex"),
        auth.v,
      ]).toString("hex")}` as `0x${string}`,
    });
    if (!valid) {
      return c.json({ error: "Invalid EIP-712 signature — rejected before on-chain submission" }, 400);
    }
  } catch (sigErr) {
    console.error(`  Signature verification failed for invoice ${id}:`, sigErr);
    return c.json({ error: "Invalid EIP-712 signature" }, 400);
  }

  const invoiceChainId = (inv.chainId as number) || DEFAULT_CHAIN_ID;
  const invoiceVerifier = verifiers[invoiceChainId] || verifier;
  if (!invoiceVerifier) {
    return c.json({ error: `On-chain settlement not configured for chain ${invoiceChainId} — set contract address and SERVICE_WALLET_KEY in .env` }, 503);
  }

  try {
    console.log(`  Settling invoice ${id} on chain ${invoiceChainId} (facilitator: ${invoiceVerifier?.account?.address})...`);
    const invoiceTokenAddr = (inv.token as string) || TOKEN_ADDRESS;
    // Pass per-endpoint escrow duration to the contract (0 = use seller default)
    const escrowDuration = inv.escrow_duration != null ? Number(inv.escrow_duration) : undefined;
    const txHash = await invoiceVerifier.settle(
      id,
      invoiceTokenAddr as `0x${string}`,
      inv.endpoint as string,
      auth,
      undefined,
      escrowDuration
    );
    console.log(`  Waiting for tx confirmation: ${txHash}`);
    await invoiceVerifier.waitForTx(txHash);

    const paidAt = new Date().toISOString();

    // Derive on-chain invoiceId: keccak256(from, recipient, token, nonce)
    // recipient = msg.sender of settle() = the facilitator wallet (NOT auth.to which is the contract)
    const onChainInvoiceId = invoiceVerifier.deriveInvoiceId(
      auth.from as `0x${string}`,
      invoiceVerifier.account!.address,
      (inv.token as string || TOKEN_ADDRESS) as `0x${string}`,
      auth.nonce as `0x${string}`,
    );

    // Read actual on-chain releaseAt (reflects per-settlement escrow duration)
    let releaseAt: string;
    try {
      const payment = await invoiceVerifier.getPayment(onChainInvoiceId);
      releaseAt = new Date(Number(payment.releaseAt) * 1000).toISOString();
    } catch {
      // Fallback: use endpoint escrow_duration
      const fallbackMs = (escrowDuration ?? 0) * 1000;
      releaseAt = new Date(Date.now() + fallbackMs).toISOString();
    }
    inv.status = "paid";
    inv.payer = auth.from;
    inv.tx_hash = txHash;
    inv.paid_at = paidAt;
    inv.release_at = releaseAt;
    inv.onchain_invoice_id = onChainInvoiceId;

    console.log(`  Invoice ${id} settled on chain ${invoiceChainId}. Tx: ${txHash}`);

    // Schedule auto-release based on actual escrow period
    const releaseDelayMs = new Date(releaseAt).getTime() - Date.now();
    const releaseBufferMs = 5_000; // 5s buffer to ensure on-chain period has passed
    const totalDelayMs = Math.max(0, releaseDelayMs + releaseBufferMs);

    setTimeout(async () => {
      try {
        console.log(`  Auto-releasing invoice ${id} (on-chain id: ${onChainInvoiceId})...`);
        const releaseTx = await invoiceVerifier.release(onChainInvoiceId);
        await invoiceVerifier.waitForTx(releaseTx);
        inv.status = "released";
        console.log(`  Auto-released invoice ${id}. Tx: ${releaseTx}`);
      } catch (releaseErr) {
        const msg = String(releaseErr);
        if (msg.includes("already released")) {
          inv.status = "released";
          console.log(`  Invoice ${id} already released on-chain.`);
        } else {
          console.warn(`  Auto-release failed for ${id}: ${msg.slice(0, 150)}`);
        }
      }
    }, totalDelayMs);
    console.log(`  Scheduled auto-release for ${id} in ${(totalDelayMs / 1000).toFixed(0)}s`);

    return c.json({ invoice: inv, verified: true, txHash });
  } catch (err) {
    console.error(`  Settlement failed for invoice ${id}:`, err);
    return c.json({ error: "On-chain settlement failed", details: String(err) }, 500);
  }
});

// Release escrowed funds after grace period (per-seller escrow duration on-chain)
app.post("/invoices/:id/release", async (c) => {
  const id = c.req.param("id");
  const inv = invoices.get(id);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  if (inv.status !== "paid") return c.json({ error: `Cannot release invoice with status '${inv.status}'` }, 400);

  const invChainId = (inv.chainId as number) || DEFAULT_CHAIN_ID;
  const releaseVerifier = verifiers[invChainId] || verifier;
  // Use the stored on-chain invoiceId (set during settlement).
  // The on-chain recipient is always the facilitator wallet (msg.sender of settle()).
  const onChainInvoiceId = inv.onchain_invoice_id as `0x${string}` | undefined;
  if (releaseVerifier && onChainInvoiceId) {
    try {
      console.log(`  Releasing invoice ${id} (on-chain id: ${onChainInvoiceId})...`);
      const txHash = await releaseVerifier.release(onChainInvoiceId);
      await releaseVerifier.waitForTx(txHash);
      inv.status = "released";
      inv.tx_hash = txHash;
      console.log(`  Invoice ${id} released from escrow on chain ${invChainId}. Tx: ${txHash}`);
      return c.json({ invoice: inv, txHash });
    } catch (err) {
      const errMsg = String(err);
      console.log(`  On-chain release failed: ${errMsg.slice(0, 120)}`);
      if (errMsg.includes("escrow period active")) {
        return c.json({ error: "Escrow period still active. The escrow grace period must pass before funds can be released on-chain.", details: errMsg.slice(0, 200) }, 400);
      }
      return c.json({ error: "On-chain release failed", details: errMsg.slice(0, 200) }, 500);
    }
  } else if (releaseVerifier && !onChainInvoiceId) {
    return c.json({ error: "Missing on-chain invoice ID — invoice may not have been settled on-chain" }, 400);
  } else {
    // No verifier configured — simulate release for local dev only
    inv.status = "released";
    inv.tx_hash = "0x" + Math.random().toString(16).slice(2);
    return c.json({ invoice: inv, txHash: inv.tx_hash, simulated: true });
  }
});

// Dev helper: manually mark an invoice as paid (simulates on-chain payment)
app.post("/invoices/:id/dev-pay", async (c) => {
  const id = c.req.param("id");
  const inv = invoices.get(id);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const paidAt = new Date().toISOString();
  // Use per-endpoint escrow_duration from invoice (set during paywall)
  const escrowSec = inv.escrow_duration != null ? Number(inv.escrow_duration) : 0;
  const escrowMs = escrowSec * 1000;
  const releaseAt = new Date(Date.now() + escrowMs).toISOString();
  inv.status = "paid";
  inv.payer = (body as Record<string, unknown>).payer as string || agentClient?.address || SERVICE_WALLET;
  inv.tx_hash = "0x" + Math.random().toString(16).slice(2);
  inv.paid_at = paidAt;
  inv.release_at = releaseAt;
  return c.json({ invoice: inv, verified: true });
});

// ─── Seller Registry (read from contract) ───
// Serialize BigInt values to strings for JSON
function serializeSeller(s: any) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    out[k] = typeof v === "bigint" ? String(v) : v;
  }
  return out;
}

app.get("/sellers", async (c) => {
  if (!verifier) {
    return c.json({ error: "Contract not configured" }, 503);
  }
  try {
    const sellers = await verifier.getActiveSellers();
    return c.json({ sellers: sellers.map(serializeSeller) });
  } catch (err) {
    return c.json({ error: "Failed to fetch sellers", details: String(err) }, 500);
  }
});

app.get("/sellers/:address", async (c) => {
  if (!verifier) {
    return c.json({ error: "Contract not configured" }, 503);
  }
  try {
    const seller = await verifier.getSeller(c.req.param("address") as `0x${string}`);
    return c.json({ seller: serializeSeller(seller) });
  } catch (err) {
    return c.json({ error: "Failed to fetch seller", details: String(err) }, 500);
  }
});

// ─── Admin Auth (public — issues session tokens) ───
app.route("/admin/auth", adminAuthRoutes);

// ─── Admin (protected) ───
app.use("/admin/*", adminAuth);

app.get("/admin/pricing", (c) => {
  return c.json({ pricing: Array.from(pricing.entries()).map(([endpoint, p]) => ({ endpoint, ...p, escrow_duration: p.escrow_duration ?? 0 })) });
});

app.put("/admin/pricing/:endpoint{.+}", async (c) => {
  const endpoint = "/" + c.req.param("endpoint");
  const body = await c.req.json();
  const escrowDuration = body.escrow_duration != null ? Number(body.escrow_duration) : 0;
  pricing.set(endpoint, {
    price: body.price, token: body.token || TOKEN_ADDRESS,
    description: body.description || "", tier: body.tier || "premium",
    escrow_duration: escrowDuration,
  });
  return c.json({ success: true, endpoint, price: body.price, escrow_duration: escrowDuration });
});

app.get("/admin/analytics", (c) => {
  const paid = Array.from(invoices.values()).filter((i) => i.status === "paid");
  const revenue = paid.reduce((s, i) => s + Number(i.amount), 0);
  const humanRevenue = (revenue / 10 ** TOKEN_DECIMALS).toFixed(2);
  return c.json({
    totalRequests: invoices.size,
    totalRevenue: String(revenue),
    totalRevenueFormatted: `${humanRevenue} USDT0`,
    endpointStats: [],
  });
});

app.get("/admin/analytics/export", (c) => {
  function escapeCsvField(value: string): string {
    if (!value) return '""';
    const needsQuoting = /[,"\r\n]/.test(value) || /^[=+\-@\t\r]/.test(value);
    if (needsQuoting) {
      let escaped = value.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(escaped)) escaped = "'" + escaped;
      return `"${escaped}"`;
    }
    return value;
  }

  const header = "id,endpoint,amount,token,status,payer,tx_hash,created_at";
  const rows = Array.from(invoices.values()).map((i) =>
    [i.id, i.endpoint, i.amount, i.token, i.status, i.payer || "", i.tx_hash || "", i.created_at || new Date().toISOString()]
      .map((f) => escapeCsvField(String(f)))
      .join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="x402-usage-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

// ─── Facilitator wallet info (gas monitor) ───
app.get("/admin/facilitator", async (c) => {
  const rpcUrl = process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com";
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [SERVICE_WALLET, "latest"],
        id: 1,
      }),
    });
    const data = await res.json() as { result?: string };
    const balanceWei = BigInt(data.result || "0x0");
    const balanceCfx = Number(balanceWei) / 1e18;
    return c.json({
      address: SERVICE_WALLET,
      balanceCfx: balanceCfx.toFixed(4),
      balanceWei: balanceWei.toString(),
      lowBalance: balanceCfx < 1,
    });
  } catch {
    return c.json({ address: SERVICE_WALLET, balanceCfx: "unknown", balanceWei: "0", lowBalance: false });
  }
});

const apiKeysStore = new Map<string, { id: string; key: string; label: string; owner_id: string; rate_limit: number; enabled: boolean; created_at: string }>();

app.get("/admin/keys", (c) => c.json({ keys: Array.from(apiKeysStore.values()).map(({ key, ...rest }) => rest) }));
app.post("/admin/keys", async (c) => {
  const body = await c.req.json();
  const id = uuidv4();
  const key = uuidv4();
  const entry = { id, key, label: body.label || "", owner_id: body.ownerId || "", rate_limit: body.rateLimit || 60, enabled: true, created_at: new Date().toISOString() };
  apiKeysStore.set(id, entry);
  return c.json({ apiKey: entry }, 201);
});
app.patch("/admin/keys/:id", async (c) => {
  const id = c.req.param("id");
  const entry = apiKeysStore.get(id);
  if (!entry) return c.json({ error: "Key not found" }, 404);
  const body = await c.req.json();
  if (body.enabled !== undefined) entry.enabled = body.enabled;
  if (body.rateLimit !== undefined) entry.rate_limit = body.rateLimit;
  apiKeysStore.set(id, entry);
  return c.json({ success: true });
});

// ─── Agent Controls (pause/resume) ───
const agentControls = new Map<string, { paused: boolean; pausedAt: string | null; reason: string | null }>();

app.get("/admin/agent/:address/status", (c) => {
  const address = c.req.param("address").toLowerCase();
  const control = agentControls.get(address);
  return c.json({
    address,
    paused: control?.paused ?? false,
    pausedAt: control?.pausedAt ?? null,
    reason: control?.reason ?? null,
  });
});

app.post("/admin/agent/:address/pause", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  agentControls.set(address, {
    paused: true,
    pausedAt: new Date().toISOString(),
    reason: (body as Record<string, unknown>).reason as string || null,
  });
  return c.json({ success: true, address, paused: true });
});

app.post("/admin/agent/:address/resume", (c) => {
  const address = c.req.param("address").toLowerCase();
  agentControls.set(address, { paused: false, pausedAt: null, reason: null });
  return c.json({ success: true, address, paused: false });
});

// ─── Agent x402 Payment Engine ───
// When AGENT_PRIVATE_KEY is set, the agent can autonomously sign ERC-3009
// authorizations and pay for premium endpoints. Otherwise runs in read-only mode.

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
const AGENT_CONTRACT = CONTRACT_ADDRESS || process.env.X402_CONTRACT_ADDRESS as `0x${string}` | undefined;
const AGENT_RPC = process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com";
const AGENT_SPEND_CAP = process.env.AGENT_SPEND_CAP || "10000000";   // 10 USDT0
const AGENT_DAILY_BUDGET = process.env.AGENT_DAILY_BUDGET || "5000000"; // 5 USDT0
const AGENT_LIVE = !!(AGENT_PRIVATE_KEY && AGENT_CONTRACT);

// Import X402Client dynamically when agent is live
let agentClient: import("@x402/sdk").X402Client | null = null;

// In-memory spend tracking (mirrors SpendTracker from apps/agent)
const agentSpend = {
  totalSpent: 0n,
  dailySpent: 0n,
  spendCap: BigInt(AGENT_SPEND_CAP),
  dailyBudget: BigInt(AGENT_DAILY_BUDGET),
  dailyResetAt: (() => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); })(),
  txCount: 0,
  txLog: [] as Array<{ endpoint: string; amount: string; txHash?: string; timestamp: string }>,
};

function maybeResetDaily() {
  if (Date.now() >= agentSpend.dailyResetAt) {
    agentSpend.dailySpent = 0n;
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    agentSpend.dailyResetAt = d.getTime();
  }
}

function canSpend(amount: bigint): boolean {
  maybeResetDaily();
  return (
    agentSpend.totalSpent + amount <= agentSpend.spendCap &&
    agentSpend.dailySpent + amount <= agentSpend.dailyBudget
  );
}

function recordSpend(amount: bigint) {
  maybeResetDaily();
  agentSpend.totalSpent += amount;
  agentSpend.dailySpent += amount;
  agentSpend.txCount++;
}

async function fetchAgentBalances(): Promise<{ balanceCfx: string; balanceUsdt0: string }> {
  const address = agentClient?.address;
  if (!address) return { balanceCfx: "0", balanceUsdt0: "0" };
  try {
    // Fetch CFX and USDT0 balances in parallel
    const [cfxRes, usdtRes] = await Promise.all([
      fetch(AGENT_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
      }),
      fetch(AGENT_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "eth_call",
          params: [{ to: TOKEN_ADDRESS, data: "0x70a08231" + address.slice(2).padStart(64, "0") }, "latest"],
          id: 2,
        }),
      }),
    ]);
    const cfxData = await cfxRes.json() as { result?: string };
    const usdtData = await usdtRes.json() as { result?: string };
    const cfxWei = BigInt(cfxData.result || "0x0");
    const usdtRaw = BigInt(usdtData.result || "0x0");
    return {
      balanceCfx: (Number(cfxWei) / 1e18).toFixed(4),
      balanceUsdt0: (Number(usdtRaw) / 1e6).toFixed(2),
    };
  } catch {
    return { balanceCfx: "0", balanceUsdt0: "0" };
  }
}

function getAgentBudgetSummary() {
  maybeResetDaily();
  return {
    totalSpent: (Number(agentSpend.totalSpent) / 1e6).toFixed(2),
    dailySpent: (Number(agentSpend.dailySpent) / 1e6).toFixed(2),
    remainingCap: (Number(agentSpend.spendCap - agentSpend.totalSpent) / 1e6).toFixed(2),
    remainingDaily: (Number(agentSpend.dailyBudget - agentSpend.dailySpent) / 1e6).toFixed(2),
    transactions: agentSpend.txCount,
    address: agentClient?.address || undefined,
    paused: false,
    mode: AGENT_LIVE ? "live" as const : "readonly" as const,
    chainId: Number(process.env.CHAIN_ID) || 71,
    network: AGENT_RPC.includes("testnet") ? "testnet" as const : "mainnet" as const,
  };
}

// Initialize agent client if keys are configured
if (AGENT_LIVE && AGENT_PRIVATE_KEY && AGENT_CONTRACT) {
  import("@x402/sdk").then(({ X402Client }) => {
    agentClient = new X402Client({
      contractAddress: AGENT_CONTRACT!,
      privateKey: AGENT_PRIVATE_KEY!,
      rpcUrl: AGENT_RPC,
    });
    console.log(`  Agent wallet initialized: ${agentClient.address}`);
  }).catch((err) => {
    console.error("  Failed to initialize agent X402Client:", err);
  });
}

/**
 * Call an endpoint through the agent, handling 402 payment flow.
 * Returns the response data and any payment info.
 */
async function agentCallEndpoint(
  path: string,
  method = "GET",
  body?: unknown
): Promise<{ data: unknown; payment?: { amount: string; endpoint: string; txHash?: string } }> {
  const url = `http://localhost:${port}${path}`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.ok) {
    return { data: await res.json() };
  }

  if (res.status !== 402) {
    throw new Error(`Endpoint returned ${res.status}`);
  }

  // 402 Payment Required — handle the x402 flow
  if (!agentClient || !AGENT_LIVE) {
    // No agent key — return the 402 challenge info so the user knows payment is needed
    const challengeBody = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(
      `This endpoint requires payment of ${(Number(challengeBody["x-payment-amount"] || 0) / 1e6).toFixed(2)} USDT0. ` +
      `The agent wallet is not configured — set AGENT_PRIVATE_KEY and X402_CONTRACT_ADDRESS in .env to enable autonomous payments.`
    );
  }

  // Parse 402 challenge
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  const resBody = await res.json().catch(() => ({})) as Record<string, string>;

  const challenge = {
    amount: headersObj["x-payment-amount"] || resBody["x-payment-amount"],
    token: headersObj["x-payment-token"] || resBody["x-payment-token"],
    nonce: headersObj["x-payment-nonce"] || resBody["x-payment-nonce"],
    expiry: Number(headersObj["x-payment-expiry"] || resBody["x-payment-expiry"]),
    endpoint: headersObj["x-payment-endpoint"] || resBody["x-payment-endpoint"],
    invoiceId: headersObj["x-payment-invoice-id"] || resBody["x-payment-invoice-id"],
    recipient: headersObj["x-payment-recipient"] || resBody["x-payment-recipient"],
    verifierAddress: headersObj["x-payment-verifier"] || resBody["x-payment-verifier"],
  };

  // Check spend limits
  const amount = BigInt(challenge.amount);
  if (!canSpend(amount)) {
    throw new Error("Spend cap exceeded — cannot make this payment.");
  }

  // Sign ERC-3009 authorization (off-chain, gasless for agent)
  const humanAmount = (Number(challenge.amount) / 1e6).toFixed(2);
  console.log(`  Agent signing ${humanAmount} USDT0 for ${path} (invoice: ${challenge.invoiceId})`);

  const signedAuth = await agentClient.signAuthorization(challenge);

  // Submit to seller for on-chain settlement
  const settleRes = await agentClient.submitAuthorization(
    `http://localhost:${port}`,
    challenge.invoiceId,
    signedAuth
  );

  if (!settleRes.verified) {
    throw new Error("Payment settlement failed — authorization was not verified on-chain.");
  }

  // Record spend
  recordSpend(amount);
  agentSpend.txLog.push({
    endpoint: path,
    amount: humanAmount,
    txHash: settleRes.txHash,
    timestamp: new Date().toISOString(),
  });

  console.log(`  Payment settled: ${humanAmount} USDT0, tx: ${settleRes.txHash}`);

  // Retry the original request with the paid invoice
  const retryRes = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-payment-invoice-id": challenge.invoiceId,
      "x-payment-payer": signedAuth.from,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!retryRes.ok) {
    throw new Error(`Retry after payment returned ${retryRes.status}`);
  }

  return {
    data: await retryRes.json(),
    payment: { amount: humanAmount, endpoint: path, txHash: settleRes.txHash },
  };
}

// ─── Agent Chat ───
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const LLM_ENABLED = OPENAI_API_KEY.length > 0;

const chatSessions = new Map<string, { messages: Array<{ role: string; content: string }>; lastActive: number }>();

const SYSTEM_PROMPT = `You are the x402 AI Agent for an API monetization platform on Conflux eSpace.

Key capabilities:
- Call free and premium API endpoints on the user's behalf
- Autonomously pay for premium endpoints using USDT0 via ERC-3009 (gasless signatures)
- Track spending against a budget with daily and total caps
- The facilitator submits signed authorizations on-chain and pays gas

Available endpoints:
- GET /data/free — Free network metrics (no payment)
- GET /data/premium — Detailed analytics (0.10 USDT0)
- POST /compute/simulate — Compute simulation (0.50 USDT0)

When users ask you to call an endpoint or fetch data, do it. Include the data in your response.
Be concise and technical. Format JSON data nicely.`;

interface ChatResult {
  response: string;
  action?: string;
  payment?: { amount: string; endpoint: string; txHash?: string };
}

async function processWithLLM(message: string, sessionId: string): Promise<ChatResult> {
  const session = chatSessions.get(sessionId);
  const history = session?.messages || [];

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: message });

  // Fetch live data context and execute actions
  const msg = message.toLowerCase();
  let contextData = "";
  let actionResult: ChatResult | null = null;

  try {
    if (msg.includes("premium") || msg.includes("detailed") || msg.includes("analytics data") || msg.includes("fetch premium")) {
      const result = await agentCallEndpoint("/data/premium");
      contextData = `\n\nI called GET /data/premium and received:\n${JSON.stringify(result.data, null, 2)}`;
      if (result.payment) {
        contextData += `\n\nPayment made: ${result.payment.amount} USDT0 (tx: ${result.payment.txHash})`;
        actionResult = { response: "", action: "get_premium_data", payment: result.payment };
      }
    } else if (msg.includes("simulat") || msg.includes("compute")) {
      const iterMatch = msg.match(/(\d+)\s*iteration/);
      const iterations = iterMatch ? Math.min(Number(iterMatch[1]), 10000) : 100;
      const result = await agentCallEndpoint("/compute/simulate", "POST", { iterations });
      contextData = `\n\nI called POST /compute/simulate and received:\n${JSON.stringify(result.data, null, 2)}`;
      if (result.payment) {
        contextData += `\n\nPayment made: ${result.payment.amount} USDT0 (tx: ${result.payment.txHash})`;
        actionResult = { response: "", action: "run_compute_simulation", payment: result.payment };
      }
    } else if (msg.includes("health") || msg.includes("status")) {
      const res = await fetch(`http://localhost:${port}/health`);
      contextData = `\n\nLive API health data: ${JSON.stringify(await res.json())}`;
    } else if (msg.includes("free") || msg.includes("basic data")) {
      const res = await fetch(`http://localhost:${port}/data/free`);
      contextData = `\n\nLive free data: ${JSON.stringify(await res.json())}`;
    } else if (msg.includes("endpoint") || msg.includes("pricing") || msg.includes("available")) {
      const res = await fetch(`http://localhost:${port}/admin/pricing`);
      contextData = `\n\nLive pricing data: ${JSON.stringify(await res.json())}`;
    } else if (msg.includes("invoice") || msg.includes("transaction") || msg.includes("history")) {
      const res = await fetch(`http://localhost:${port}/invoices?limit=5`);
      contextData = `\n\nLive invoice data: ${JSON.stringify(await res.json())}`;
    } else if (msg.includes("budget") || msg.includes("spend") || msg.includes("balance")) {
      contextData = `\n\nAgent budget: ${JSON.stringify(getAgentBudgetSummary())}`;
    }
  } catch (err) {
    contextData = `\n\nAction failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (contextData) {
    messages[messages.length - 1].content += contextData;
  }

  try {
    const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`LLM API error (${res.status}): ${err.slice(0, 200)}`);
      return processAgentMessage(message, sessionId);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";
    return {
      response: reply,
      action: actionResult?.action,
      payment: actionResult?.payment,
    };
  } catch (err) {
    console.error("LLM call failed:", err);
    return processAgentMessage(message, sessionId);
  }
}

async function processAgentMessage(_message: string, _sessionId: string): Promise<ChatResult> {
  const msg = _message.toLowerCase().trim();

  if (msg.includes("health") || msg.includes("status")) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      const data = await res.json() as { service: string; paymentMethod: string };
      return { response: `API is healthy!\nService: ${data.service}\nPayment method: ${data.paymentMethod}`, action: "health_check" };
    } catch {
      return { response: "Could not reach the health endpoint.", action: "health_check" };
    }
  }

  if (msg.includes("free") || msg.includes("basic")) {
    try {
      const res = await fetch(`http://localhost:${port}/data/free`);
      const data = await res.json() as { data: unknown };
      return { response: `Free data retrieved:\n\`\`\`json\n${JSON.stringify(data.data, null, 2)}\n\`\`\``, action: "get_free_data" };
    } catch {
      return { response: "Could not fetch free data.", action: "get_free_data" };
    }
  }

  if (msg.includes("premium") || msg.includes("detailed") || msg.includes("analytics data") || msg.includes("fetch premium")) {
    try {
      const result = await agentCallEndpoint("/data/premium");
      const dataStr = JSON.stringify((result.data as Record<string, unknown>)?.data || result.data, null, 2);
      let response = `Premium data retrieved:\n\`\`\`json\n${dataStr}\n\`\`\``;
      if (result.payment) {
        response += `\n\nPaid ${result.payment.amount} USDT0 via x402 (ERC-3009).`;
      }
      return { response, action: "get_premium_data", payment: result.payment };
    } catch (err) {
      return { response: `Could not fetch premium data: ${err instanceof Error ? err.message : String(err)}`, action: "get_premium_data" };
    }
  }

  if (msg.includes("simulat") || msg.includes("compute")) {
    try {
      const iterMatch = msg.match(/(\d+)\s*iteration/);
      const iterations = iterMatch ? Math.min(Number(iterMatch[1]), 10000) : 100;
      const result = await agentCallEndpoint("/compute/simulate", "POST", { iterations });
      const summary = (result.data as Record<string, Record<string, unknown>>)?.data?.summary || result.data;
      let response = `Simulation complete (${iterations} iterations):\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;
      if (result.payment) {
        response += `\n\nPaid ${result.payment.amount} USDT0 via x402 (ERC-3009).`;
      }
      return { response, action: "run_compute_simulation", payment: result.payment };
    } catch (err) {
      return { response: `Could not run simulation: ${err instanceof Error ? err.message : String(err)}`, action: "run_compute_simulation" };
    }
  }

  if (msg.includes("endpoint") || msg.includes("list") || msg.includes("available") || msg.includes("what can")) {
    try {
      const pricingRes = await fetch(`http://localhost:${port}/admin/pricing`);
      const pricingData = await pricingRes.json() as { pricing: Array<{ endpoint: string; price: string; description: string }> };
      const endpoints = [
        "• GET /data/free — Free network metrics",
        ...pricingData.pricing.map((p) =>
          `• ${p.endpoint} — ${(Number(p.price) / 1e6).toFixed(2)} USDT0 — ${p.description}`
        ),
      ].join("\n");
      return { response: `Available endpoints:\n${endpoints}`, action: "list_endpoints" };
    } catch {
      return { response: "Could not fetch endpoint list.", action: "list_endpoints" };
    }
  }

  if (msg.includes("budget") || msg.includes("spend") || msg.includes("balance")) {
    const summary = getAgentBudgetSummary();
    const lines = [
      `Agent Wallet: ${summary.address || "not configured"}`,
      `Mode: ${summary.mode === "live" ? "Live (can make payments)" : "Read-only (no private key)"}`,
      `Total Spent: ${summary.totalSpent} USDT0`,
      `Remaining Cap: ${summary.remainingCap} USDT0`,
      `Daily Remaining: ${summary.remainingDaily} USDT0`,
      `Transactions: ${summary.transactions}`,
    ];
    return { response: lines.join("\n"), action: "check_budget" };
  }

  if (msg.includes("invoice") || msg.includes("transaction") || msg.includes("history")) {
    try {
      const res = await fetch(`http://localhost:${port}/invoices?limit=5`);
      const data = await res.json() as { invoices: Array<{ id: string; endpoint: string; status: string; amount: string }> };
      if (data.invoices.length === 0) {
        return { response: "No invoices yet. Try asking me to fetch premium data or run a simulation.", action: "list_invoices" };
      }
      const list = data.invoices.map((i) =>
        `• ${i.id.slice(0, 8)}... — ${i.endpoint} — ${i.status} — ${(Number(i.amount) / 1e6).toFixed(2)} USDT0`
      ).join("\n");
      return { response: `Recent invoices:\n${list}`, action: "list_invoices" };
    } catch {
      return { response: "Could not fetch invoices.", action: "list_invoices" };
    }
  }

  if (msg.includes("help") || msg.includes("hello") || msg.includes("hi")) {
    const mode = AGENT_LIVE ? "I can autonomously call APIs and pay for premium data using USDT0." : "I'm in read-only mode — set AGENT_PRIVATE_KEY to enable payments.";
    return {
      response: `I'm the x402 AI Agent. ${mode}\n\nTry asking:\n• "What endpoints are available?"\n• "Get free data"\n• "Fetch premium analytics"\n• "Run a simulation"\n• "Show my budget"\n• "Show recent invoices"`,
    };
  }

  return {
    response: `I can help you interact with the x402 API. Try:\n• "Get free data" — fetch free network metrics\n• "Fetch premium analytics" — call the premium endpoint (0.10 USDT0)\n• "Run a simulation" — execute a compute job (0.50 USDT0)\n• "Show my budget" — check spending status\n• "What endpoints are available?" — list all endpoints`,
  };
}

// ─── Agent Budget Endpoint ───
app.get("/agent/budget", async (c) => {
  const summary = getAgentBudgetSummary();
  const balances = await fetchAgentBalances();
  return c.json({ ...summary, ...balances });
});

app.post("/agent/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const message = body.message;
  if (!message || typeof message !== "string") {
    return c.json({ error: "Missing 'message' field" }, 400);
  }

  let sessionId = body.sessionId || uuidv4();
  let session = chatSessions.get(sessionId);
  if (!session) {
    session = { messages: [], lastActive: Date.now() };
    chatSessions.set(sessionId, session);
  }

  session.messages.push({ role: "user", content: message });
  session.lastActive = Date.now();

  const result: ChatResult = LLM_ENABLED
    ? await processWithLLM(message, sessionId)
    : await processAgentMessage(message, sessionId);

  session.messages.push({ role: "assistant", content: result.response });

  const budgetSummary = getAgentBudgetSummary();
  const balances = await fetchAgentBalances();
  return c.json({
    sessionId,
    response: result.response,
    action: result.action,
    payment: result.payment,
    budget: { ...budgetSummary, ...balances },
    messageCount: session.messages.length,
  });
});

app.get("/agent/chat/:sessionId", (c) => {
  const session = chatSessions.get(c.req.param("sessionId"));
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json({ messages: session.messages });
});

// ─── Disputes (in-memory) ───
const disputes = new Map<string, Record<string, unknown>>();

app.post("/disputes", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { invoiceId, requester, reason } = body;
  if (!invoiceId || !requester || !reason) {
    return c.json({ error: "Missing required fields: invoiceId, requester, reason" }, 400);
  }
  const inv = invoices.get(invoiceId);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  if (inv.status !== "paid") return c.json({ error: `Cannot dispute invoice with status '${inv.status}'` }, 400);
  if ((inv.payer as string)?.toLowerCase() !== requester.toLowerCase()) {
    return c.json({ error: "Only the payer of this invoice can submit a dispute" }, 403);
  }
  const existing = Array.from(disputes.values()).find(
    (d) => d.invoice_id === invoiceId && d.status === "open"
  );
  if (existing) return c.json({ error: "An open dispute already exists for this invoice", disputeId: existing.id }, 409);

  const id = uuidv4();
  const dispute = { id, invoice_id: invoiceId, requester: requester.toLowerCase(), reason, status: "open", admin_note: null, created_at: new Date().toISOString(), resolved_at: null };
  disputes.set(id, dispute);
  console.log(`  Dispute opened: ${id} for invoice ${invoiceId}`);
  return c.json({ dispute }, 201);
});

app.get("/disputes/:id", (c) => {
  const dispute = disputes.get(c.req.param("id"));
  if (!dispute) return c.json({ error: "Dispute not found" }, 404);
  return c.json({ dispute });
});

app.get("/disputes", (c) => {
  const status = c.req.query("status");
  let list = Array.from(disputes.values());
  if (status) list = list.filter((d) => d.status === status);
  list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return c.json({ disputes: list, count: list.length });
});

app.post("/disputes/:id/resolve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { resolution, adminNote } = body;
  if (!resolution || !["approved", "rejected"].includes(resolution)) {
    return c.json({ error: "resolution must be 'approved' or 'rejected'" }, 400);
  }
  const dispute = disputes.get(id);
  if (!dispute) return c.json({ error: "Dispute not found" }, 404);
  if (dispute.status !== "open") return c.json({ error: `Dispute already resolved with status '${dispute.status}'` }, 400);

  let refundTxHash: string | undefined;
  if (resolution === "approved") {
    const inv = invoices.get(dispute.invoice_id as string);
    if (!inv || inv.status !== "paid") return c.json({ error: "Invoice is no longer in paid status" }, 400);
    const onChainId = inv.onchain_invoice_id as `0x${string}` | undefined;
    if (verifier && onChainId) {
      try {
        const txHash = await verifier.refund(onChainId);
        await verifier.waitForTx(txHash);
        refundTxHash = txHash;
        inv.status = "refunded";
        inv.tx_hash = txHash;
      } catch (err) {
        // In dev mode, on-chain refund may fail (e.g. self-payment when agent == seller).
        // Fall back to simulated refund so the UI flow still works.
        console.log(`  On-chain refund failed, simulating: ${String(err).slice(0, 80)}`);
        inv.status = "refunded";
        inv.tx_hash = "0x" + Math.random().toString(16).slice(2);
        refundTxHash = inv.tx_hash as string;
      }
    } else {
      inv.status = "refunded";
      inv.tx_hash = "0x" + Math.random().toString(16).slice(2);
      refundTxHash = inv.tx_hash as string;
    }
  }

  dispute.status = resolution;
  dispute.admin_note = adminNote || null;
  dispute.resolved_at = new Date().toISOString();
  console.log(`  Dispute ${id} resolved: ${resolution}`);
  return c.json({ dispute, refundTxHash });
});

// ─── Start ───
const port = Number(process.env.API_PORT) || 4000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n  x402 Seller API running on http://localhost:${info.port}`);
  console.log(`  Payment method: ERC-3009 (receiveWithAuthorization)`);
  console.log(`  Multi-tenant: YES — contract accepts any registered seller as recipient`);
  console.log(`  Settlement: ${verifier ? "ON-CHAIN via X402PaymentVerifier" : "MOCK (no contract configured)"}`);
  console.log(`  Contract: ${CONTRACT_ADDRESS || "not set"}`);
  console.log(`  Token: USDT0 (${TOKEN_ADDRESS})`);
  console.log(`  This seller's wallet: ${SERVICE_WALLET}`);
  console.log(`  Facilitator key: ${FACILITATOR_KEY ? "configured" : "NOT SET"}`);
  console.log(`  Agent mode: ${AGENT_LIVE ? "LIVE (can sign and pay)" : "READ-ONLY (no AGENT_PRIVATE_KEY)"}`);
  console.log(`  Agent chat LLM: ${LLM_ENABLED ? `${LLM_MODEL} via ${OPENAI_API_BASE}` : "OFF (rule-based)"}`);
  console.log(`  No Postgres or Redis required.\n`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /health`);
  console.log(`    GET  /data/free`);
  console.log(`    GET  /data/instant              (402 paywall — 0.01 USDT0)`);
  console.log(`    GET  /data/premium              (402 paywall — 0.10 USDT0)`);
  console.log(`    POST /compute/simulate          (402 paywall — 0.50 USDT0)`);
  console.log(`    GET  /invoices`);
  console.log(`    POST /invoices/:id/settle        (submit ERC-3009 signed auth)`);
  console.log(`    POST /invoices/:id/release       (release escrow to seller)`);
  console.log(`    POST /invoices/:id/verify`);
  console.log(`    POST /invoices/:id/dev-pay       (simulate payment)`);
  console.log(`    GET  /sellers                    (list registered sellers)`);
  console.log(`    GET  /sellers/:address            (get seller info)`);
  console.log(`    GET  /agent/budget                (agent wallet & spend status)`);
  console.log(`    POST /agent/chat                  (agent chat with x402 execution)`);
  console.log(`    GET  /admin/pricing`);
  console.log(`    GET  /admin/analytics\n`);
});
