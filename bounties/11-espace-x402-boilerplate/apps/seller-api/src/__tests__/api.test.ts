import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// ─── Mock DB ───
const mockRows: Record<string, unknown[]> = {};
const sqlMock: any = vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => {
  const query = _strings.join("?");
  // Route based on query content
  if (query.includes("endpoint_pricing") && query.includes("SELECT")) {
    return Promise.resolve(mockRows.pricing || []);
  }
  if (query.includes("disputes") && query.includes("INSERT")) {
    return Promise.resolve(mockRows.disputeInsert || [{ id: "disp-new", invoice_id: _values[0], requester: _values[1], reason: _values[2], status: "open", created_at: new Date().toISOString() }]);
  }
  if (query.includes("disputes") && query.includes("UPDATE")) {
    return Promise.resolve({ count: 1 });
  }
  if (query.includes("disputes") && query.includes("SELECT")) {
    return Promise.resolve(mockRows.disputes || []);
  }
  if (query.includes("invoices") && query.includes("SELECT")) {
    return Promise.resolve(mockRows.invoices || []);
  }
  if (query.includes("INSERT INTO invoices")) {
    return Promise.resolve([]);
  }
  if (query.includes("UPDATE invoices")) {
    return Promise.resolve({ count: 1 });
  }
  if (query.includes("usage_logs")) {
    return Promise.resolve([]);
  }
  if (query.includes("audit_logs")) {
    return Promise.resolve([]);
  }
  if (query.includes("api_keys") && query.includes("SELECT")) {
    return Promise.resolve(mockRows.apiKeys || []);
  }
  return Promise.resolve([]);
});
sqlMock.unsafe = vi.fn(() => Promise.resolve());

vi.mock("../db/index.js", () => ({ sql: sqlMock }));

// ─── Mock verifier ───
const mockVerifier = {
  settle: vi.fn(),
  waitForTx: vi.fn(),
  refund: vi.fn(),
  release: vi.fn(),
  isInvoicePaid: vi.fn(),
  getPayment: vi.fn(() => Promise.resolve({ releaseAt: BigInt(Math.floor(Date.now() / 1000) + 86400) })),
  account: { address: "0xE90fA6AA4F03Ae276049B328d62fF7702b6242ba" as `0x${string}` },
};
vi.mock("../lib/verifier.js", () => ({ verifier: mockVerifier }));

// ─── Mock escrow release job ───
const mockScheduleEscrowRelease = vi.fn(() => Promise.resolve());
vi.mock("../jobs/escrowRelease.js", () => ({ scheduleEscrowRelease: mockScheduleEscrowRelease }));

// ─── Mock config ───
const mockConfig = {
  port: 4000,
  databaseUrl: "postgresql://test",
  redisUrl: "redis://localhost:6379",
  contractAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  serviceWalletKey: undefined,
  serviceWalletAddress: "0xE90fA6AA4F03Ae276049B328d62fF7702b6242ba",
  rpcUrl: "https://evmtestnet.confluxrpc.com",
  tokenAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  adminApiKey: "test-admin-key-123",
  network: "testnet",
  chainId: 71,
};
vi.mock("../lib/config.js", () => ({ config: mockConfig }));

// ─── Mock viem verifyTypedData (keep real hash functions for hashNonce) ───
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    verifyTypedData: vi.fn(() => Promise.resolve(true)),
  };
});

// ─── Mock alerts ───
const mockSendAlert = vi.fn();
vi.mock("../lib/alerts.js", () => ({ sendAlert: mockSendAlert }));

// ─── Mock event bus ───
vi.mock("../lib/eventBus.js", () => ({ publish: vi.fn() }));

// ─── Mock BullMQ schedule ───
vi.mock("../jobs/invoiceExpiry.js", () => ({
  scheduleInvoiceExpiry: vi.fn(() => Promise.resolve()),
  invoiceExpiryQueue: {},
  startInvoiceExpiryWorker: vi.fn(),
}));

// ─── Import routes after mocks ───
const { hashNonce } = await import("@x402/shared");
const { x402Paywall } = await import("../middleware/x402.js");
const { invoiceRoutes, resetSettleRateLimit } = await import("../routes/invoices.js");
const { adminAuth } = await import("../middleware/adminAuth.js");
const { adminRoutes } = await import("../routes/admin.js");
const { disputeRoutes } = await import("../routes/disputes.js");

// ─── Test app ───
function createTestApp() {
  const app = new Hono();
  app.route("/data", (() => {
    const r = new Hono();
    r.get("/premium", x402Paywall, (c) => c.json({ data: "premium" }));
    return r;
  })());
  app.route("/invoices", invoiceRoutes);
  app.route("/disputes", disputeRoutes);
  app.use("/admin/*", adminAuth);
  app.route("/admin", adminRoutes);
  return app;
}

describe("x402 Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.pricing = [];
    mockRows.invoices = [];
    app = createTestApp();
  });

  it("should pass through free endpoints (no pricing configured)", async () => {
    mockRows.pricing = []; // No pricing = free
    const res = await app.request("/data/premium");
    // With empty pricing, middleware calls next()
    expect(res.status).toBe(200);
  });

  it("should return 402 with correct headers for premium endpoints", async () => {
    mockRows.pricing = [{ price: "100000", token: "0xMockToken", description: "Premium" }];
    mockRows.invoices = []; // No paid invoice

    // Override config for this test
    const res = await app.request("/data/premium");
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.error).toBe("Payment Required");
    expect(body.invoiceId).toBeDefined();
    expect(body.paymentMethod).toBe("ERC-3009");
    expect(body["x-payment-amount"]).toBe("100000");
    expect(body["x-payment-token"]).toBe("0xMockToken");
    expect(body["x-payment-nonce"]).toBeDefined();
    expect(body["x-payment-expiry"]).toBeDefined();
    expect(body["x-payment-endpoint"]).toBe("/data/premium");
    expect(body["x-payment-invoice-id"]).toBeDefined();
  });

  it("should pass through when valid paid invoice is provided", async () => {
    mockRows.pricing = [{ price: "100000", token: "0xMockToken", description: "Premium" }];
    mockRows.invoices = [{ id: "inv-123", status: "paid", endpoint: "/data/premium" }];

    const res = await app.request("/data/premium", {
      headers: { "x-payment-invoice-id": "inv-123" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBe("premium");
  });
});

describe("Settlement Endpoint", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.invoices = [];
    app = createTestApp();
  });

  it("should return 404 for non-existent invoice", async () => {
    mockRows.invoices = [];
    const res = await app.request("/invoices/nonexistent/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorization: {} }),
    });
    expect(res.status).toBe(404);
  });

  it("should return 200 immediately if already paid", async () => {
    mockRows.invoices = [{ id: "inv-1", status: "paid", endpoint: "/data/premium" }];
    const res = await app.request("/invoices/inv-1/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
  });

  it("should return 410 for expired invoice", async () => {
    mockRows.invoices = [{
      id: "inv-2",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) - 600), // expired 10 min ago
      endpoint: "/data/premium",
    }];
    const res = await app.request("/invoices/inv-2/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorization: {} }),
    });
    expect(res.status).toBe(410);
  });

  it("should return 400 for missing authorization fields", async () => {
    mockRows.invoices = [{
      id: "inv-3",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
    }];
    const res = await app.request("/invoices/inv-3/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorization: { from: "0x1" } }), // missing fields
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing ERC-3009");
  });

  it("should return 400 if authorization value too low", async () => {
    mockRows.invoices = [{
      id: "inv-4",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
    }];
    const res = await app.request("/invoices/inv-4/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", to: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: "50000", // too low
          validAfter: 0, validBefore: 9999999999, nonce: hashNonce("inv-4"),
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("value too low");
  });

  it("should settle successfully with valid authorization", async () => {
    mockRows.invoices = [{
      id: "inv-5",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
      token: "0xMockToken",
    }];
    mockVerifier.settle.mockResolvedValue("0xtxhash123");
    mockVerifier.waitForTx.mockResolvedValue({});

    const res = await app.request("/invoices/inv-5/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", to: "0x0000000000000000000000000000000000000000", value: "100000",
          validAfter: 0, validBefore: 9999999999, nonce: hashNonce("inv-5"),
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.txHash).toBe("0xtxhash123");
    expect(mockVerifier.settle).toHaveBeenCalledOnce();
    expect(mockVerifier.waitForTx).toHaveBeenCalledWith("0xtxhash123");
  });

  it("should return 500 if on-chain settlement fails", async () => {
    mockRows.invoices = [{
      id: "inv-6",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
    }];
    mockVerifier.settle.mockRejectedValue(new Error("EVM revert: insufficient balance"));

    const res = await app.request("/invoices/inv-6/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", to: "0x0000000000000000000000000000000000000000", value: "100000",
          validAfter: 0, validBefore: 9999999999, nonce: hashNonce("inv-6"),
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Settlement failed");
    expect(body.details).toContain("insufficient balance");
  });
});

describe("Admin Auth", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("should reject requests without admin key", async () => {
    const res = await app.request("/admin/pricing");
    // adminApiKey might not be set in test env → 503 or 401
    expect([401, 503]).toContain(res.status);
  });

  it("should reject requests with wrong admin key", async () => {
    // Set env for this test
    const origKey = process.env.ADMIN_API_KEY;
    process.env.ADMIN_API_KEY = "correct-key";

    // Re-import to pick up new env — but since config is cached, we test the middleware logic
    const res = await app.request("/admin/pricing", {
      headers: { authorization: "Bearer wrong-key" },
    });
    expect([401, 503]).toContain(res.status);

    process.env.ADMIN_API_KEY = origKey;
  });
});

describe("Settle Rate Limit", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.invoices = [];
    app = createTestApp();
  });

  it("should block after exceeding 5 settle attempts per minute", async () => {
    // The settle rate limiter allows 5/min per IP
    mockRows.invoices = [{ id: "inv-rl", status: "pending", expiry: String(Math.floor(Date.now() / 1000) + 300), endpoint: "/data/premium", amount: "100000" }];

    // Make 6 requests — the 6th should be rate limited
    const results = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.request("/invoices/inv-rl/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization: {} }), // Will fail at validation but after rate limit check
      });
      results.push(res.status);
    }

    // First 5 should pass rate limit (will be 400 due to bad auth, not 429)
    for (let i = 0; i < 5; i++) {
      expect(results[i]).not.toBe(429);
    }
    // 6th should be rate limited
    expect(results[5]).toBe(429);
  });
});

describe("Verify Route", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.invoices = [];
    app = createTestApp();
  });

  it("should return verified=true for already paid invoice", async () => {
    mockRows.invoices = [{ id: "inv-v1", status: "paid", endpoint: "/data/premium", amount: "100000" }];
    const res = await app.request("/invoices/inv-v1/verify", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.invoice.status).toBe("paid");
  });

  it("should return 410 for expired invoice", async () => {
    mockRows.invoices = [{
      id: "inv-v2",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) - 600),
      endpoint: "/data/premium",
      amount: "100000",
    }];
    const res = await app.request("/invoices/inv-v2/verify", { method: "POST" });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("Invoice expired");
  });

  it("should verify on-chain and update DB if found paid", async () => {
    mockRows.invoices = [{
      id: "inv-v3",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
      onchain_invoice_id: "0xabc123" as `0x${string}`,
    }];
    mockVerifier.isInvoicePaid.mockResolvedValue({ valid: true, payer: "0xPayerAddr" });

    const res = await app.request("/invoices/inv-v3/verify", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.invoice.status).toBe("paid");
    expect(body.invoice.payer).toBe("0xPayerAddr");
    expect(mockVerifier.isInvoicePaid).toHaveBeenCalledOnce();
  });

  it("should return verified=false if not found on-chain", async () => {
    mockRows.invoices = [{
      id: "inv-v4",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
    }];
    mockVerifier.isInvoicePaid.mockResolvedValue({ valid: false, payer: undefined });

    const res = await app.request("/invoices/inv-v4/verify", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
  });
});

describe("Refund Route", () => {
  let app: Hono;
  const ADMIN_KEY = "test-admin-key-123";

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.invoices = [];
    mockConfig.adminApiKey = ADMIN_KEY;
    app = createTestApp();
  });

  it("should return 404 for non-existent invoice", async () => {
    mockRows.invoices = [];
    const res = await app.request("/invoices/nonexistent/refund", {
      method: "POST",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Invoice not found");
  });

  it("should return 400 if invoice not in paid status", async () => {
    mockRows.invoices = [{
      id: "inv-r2",
      status: "pending",
      endpoint: "/data/premium",
      amount: "100000",
    }];
    const res = await app.request("/invoices/inv-r2/refund", {
      method: "POST",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Cannot refund");
    expect(body.error).toContain("pending");
  });

  it("should successfully refund a paid invoice", async () => {
    mockRows.invoices = [{
      id: "inv-r3",
      status: "paid",
      endpoint: "/data/premium",
      amount: "100000",
      payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      onchain_invoice_id: "0xabc123",
    }];
    mockVerifier.refund.mockResolvedValue("0xrefundtx456");
    mockVerifier.waitForTx.mockResolvedValue({});

    const res = await app.request("/invoices/inv-r3/refund", {
      method: "POST",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.txHash).toBe("0xrefundtx456");
    expect(body.invoice.status).toBe("refunded");
    expect(mockVerifier.refund).toHaveBeenCalledWith("0xabc123");
    expect(mockVerifier.waitForTx).toHaveBeenCalledWith("0xrefundtx456");
  });

  it("should return 500 if on-chain refund fails", async () => {
    mockRows.invoices = [{
      id: "inv-r4",
      status: "paid",
      endpoint: "/data/premium",
      amount: "100000",
      payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      onchain_invoice_id: "0xdef456",
    }];
    mockVerifier.refund.mockRejectedValue(new Error("EVM revert: transfer failed"));

    const res = await app.request("/invoices/inv-r4/refund", {
      method: "POST",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Refund failed");
    expect(body.details).toContain("transfer failed");
  });
});

describe("DB Sync Failure Recovery", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.invoices = [];
    app = createTestApp();
  });

  it("should still return txHash when settlement succeeds on-chain but DB update fails", async () => {
    mockRows.invoices = [{
      id: "inv-dbfail",
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
      token: "0xMockToken",
    }];
    mockVerifier.settle.mockResolvedValue("0xtxhash-dbfail");
    mockVerifier.waitForTx.mockResolvedValue({});

    // Make the UPDATE query throw to simulate DB failure after on-chain success.
    // The sqlMock routes UPDATE invoices queries — override it to throw for UPDATE calls.
    const originalImpl = sqlMock.getMockImplementation();
    let updateCallCount = 0;
    sqlMock.mockImplementation((_strings: TemplateStringsArray, ..._values: unknown[]) => {
      const query = _strings.join("?");
      // Only fail UPDATE invoices SET status = 'paid' (the post-settlement update)
      if (query.includes("UPDATE invoices") && query.includes("paid")) {
        updateCallCount++;
        return Promise.reject(new Error("simulated DB connection error"));
      }
      // For all other queries, use the default routing
      if (query.includes("endpoint_pricing") && query.includes("SELECT")) {
        return Promise.resolve(mockRows.pricing || []);
      }
      if (query.includes("invoices") && query.includes("SELECT")) {
        return Promise.resolve(mockRows.invoices || []);
      }
      if (query.includes("INSERT INTO invoices")) {
        return Promise.resolve([]);
      }
      if (query.includes("UPDATE invoices")) {
        return Promise.resolve({ count: 1 });
      }
      if (query.includes("usage_logs")) {
        return Promise.resolve([]);
      }
      if (query.includes("audit_logs")) {
        return Promise.resolve([]);
      }
      if (query.includes("api_keys") && query.includes("SELECT")) {
        return Promise.resolve(mockRows.apiKeys || []);
      }
      return Promise.resolve([]);
    });

    const res = await app.request("/invoices/inv-dbfail/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", to: "0x0000000000000000000000000000000000000000", value: "100000",
          validAfter: 0, validBefore: 9999999999, nonce: hashNonce("inv-dbfail"),
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });

    // The route should still return 200 with the txHash despite DB failure
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.txHash).toBe("0xtxhash-dbfail");
    expect(body.verified).toBe(true);

    // DB update was attempted 3 times (retry loop)
    expect(updateCallCount).toBe(3);

    // Alert was sent for DB sync failure
    expect(mockSendAlert).toHaveBeenCalledWith("db_sync_failure", {
      invoiceId: "inv-dbfail",
      txHash: "0xtxhash-dbfail",
    });
  });
});

describe("Dispute Resolution", () => {
  let app: Hono;
  const ADMIN_KEY = "test-admin-key-123";

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the original sql mock implementation (may have been overridden by DB Sync test)
    sqlMock.mockImplementation((_strings: TemplateStringsArray, ..._values: unknown[]) => {
      const query = _strings.join("?");
      if (query.includes("disputes") && query.includes("INSERT")) {
        return Promise.resolve(mockRows.disputeInsert || [{ id: "disp-new", invoice_id: _values[0], requester: _values[1], reason: _values[2], status: "open", created_at: new Date().toISOString() }]);
      }
      if (query.includes("disputes") && query.includes("UPDATE")) {
        return Promise.resolve({ count: 1 });
      }
      if (query.includes("disputes") && query.includes("SELECT")) {
        return Promise.resolve(mockRows.disputes || []);
      }
      if (query.includes("invoices") && query.includes("SELECT")) {
        return Promise.resolve(mockRows.invoices || []);
      }
      if (query.includes("UPDATE invoices")) {
        return Promise.resolve({ count: 1 });
      }
      return Promise.resolve([]);
    });
    resetSettleRateLimit();
    mockRows.invoices = [];
    mockRows.disputes = [];
    mockConfig.adminApiKey = ADMIN_KEY;
    app = createTestApp();
  });

  // ─── Submission tests ───

  it("should create a dispute for a paid invoice", async () => {
    mockRows.invoices = [{
      id: "inv-sub1",
      status: "paid",
      payer: "0xPayer123",
      endpoint: "/data/premium",
      amount: "100000",
    }];
    mockRows.disputes = []; // No existing open dispute

    const res = await app.request("/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-sub1", requester: "0xPayer123", reason: "Did not receive data" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.dispute).toBeDefined();
    expect(body.dispute.status).toBe("open");
  });

  it("should return 400 for missing required fields", async () => {
    const res = await app.request("/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-1" }), // missing requester and reason
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing required fields");
  });

  it("should return 404 when invoice does not exist", async () => {
    mockRows.invoices = [];
    const res = await app.request("/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "nonexistent", requester: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", reason: "test" }),
    });
    expect(res.status).toBe(404);
  });

  it("should return 400 when invoice is not in paid status", async () => {
    mockRows.invoices = [{ id: "inv-pend", status: "pending", payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }];
    const res = await app.request("/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-pend", requester: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", reason: "test" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("pending");
  });

  it("should return 403 when requester is not the payer", async () => {
    mockRows.invoices = [{ id: "inv-auth", status: "paid", payer: "0xRealPayer" }];
    const res = await app.request("/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-auth", requester: "0xWrongPerson", reason: "test" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Only the payer");
  });

  it("should return 409 when an open dispute already exists", async () => {
    mockRows.invoices = [{ id: "inv-dup", status: "paid", payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }];
    mockRows.disputes = [{ id: "existing-disp", invoice_id: "inv-dup", status: "open" }];
    const res = await app.request("/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-dup", requester: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", reason: "duplicate" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });

  // ─── Resolution tests ───

  it("should approve dispute and trigger on-chain refund", async () => {
    mockRows.disputes = [{
      id: "disp-1",
      invoice_id: "inv-d1",
      requester: "0xpayer",
      reason: "Did not receive data",
      status: "open",
      created_at: new Date().toISOString(),
    }];
    mockRows.invoices = [{
      id: "inv-d1",
      status: "paid",
      endpoint: "/data/premium",
      amount: "100000",
      payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    }];
    mockVerifier.refund.mockResolvedValue("0xrefund-disp1");
    mockVerifier.waitForTx.mockResolvedValue({});

    const res = await app.request("/disputes/disp-1/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ resolution: "approved", adminNote: "Refund granted" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refundTxHash).toBe("0xrefund-disp1");
    expect(mockVerifier.refund).toHaveBeenCalledWith("inv-d1");
    expect(mockVerifier.waitForTx).toHaveBeenCalledWith("0xrefund-disp1");
  });

  it("should return 500 when on-chain refund fails during dispute approval", async () => {
    mockRows.disputes = [{
      id: "disp-2",
      invoice_id: "inv-d2",
      requester: "0xpayer",
      reason: "Service error",
      status: "open",
      created_at: new Date().toISOString(),
    }];
    mockRows.invoices = [{
      id: "inv-d2",
      status: "paid",
      endpoint: "/data/premium",
      amount: "100000",
      payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    }];
    mockVerifier.refund.mockRejectedValue(new Error("EVM revert: transfer failed"));

    const res = await app.request("/disputes/disp-2/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ resolution: "approved" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Refund transaction failed");
    expect(body.details).toContain("transfer failed");
    expect(mockSendAlert).toHaveBeenCalledWith("refund_failed", expect.objectContaining({
      invoiceId: "inv-d2",
      disputeId: "disp-2",
    }));
  });

  it("should reject dispute without triggering refund", async () => {
    mockRows.disputes = [{
      id: "disp-3",
      invoice_id: "inv-d3",
      requester: "0xpayer",
      reason: "Changed my mind",
      status: "open",
      created_at: new Date().toISOString(),
    }];

    const res = await app.request("/disputes/disp-3/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ resolution: "rejected", adminNote: "No grounds for refund" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refundTxHash).toBeUndefined();
    expect(mockVerifier.refund).not.toHaveBeenCalled();
  });

  it("should return 400 for already resolved dispute", async () => {
    mockRows.disputes = [{
      id: "disp-4",
      invoice_id: "inv-d4",
      requester: "0xpayer",
      reason: "Test",
      status: "approved",
      created_at: new Date().toISOString(),
    }];

    const res = await app.request("/disputes/disp-4/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ resolution: "approved" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already resolved");
  });

  it("should return 400 for invalid resolution value", async () => {
    mockRows.disputes = [{
      id: "disp-5",
      invoice_id: "inv-d5",
      requester: "0xpayer",
      reason: "Test",
      status: "open",
      created_at: new Date().toISOString(),
    }];

    const res = await app.request("/disputes/disp-5/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ resolution: "invalid" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("approved");
    expect(body.error).toContain("rejected");
  });
});

describe("E2E Flow: 402 → settle → data", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    app = createTestApp();
  });

  it("full buyer flow: get 402 → extract challenge → settle with correct nonce → re-fetch data", async () => {
    // Step 1: Configure a priced endpoint
    mockRows.pricing = [{ price: "100000", token: "0xMockToken", description: "Premium data" }];
    mockRows.invoices = [];

    // Step 2: Call premium endpoint → expect 402
    const challengeRes = await app.request("/data/premium");
    expect(challengeRes.status).toBe(402);
    const challenge = await challengeRes.json() as Record<string, unknown>;
    expect(challenge.invoiceId).toBeDefined();
    expect(challenge["x-payment-nonce"]).toBeDefined();

    const invoiceId = challenge.invoiceId as string;
    const nonce = challenge["x-payment-nonce"] as string;

    // Step 3: Verify ARCH-1 — nonce equals invoiceId (bound to this invoice)
    expect(nonce).toBe(invoiceId);

    // Step 4: Build authorization with the correct nonce hash
    const correctNonce = hashNonce(invoiceId);
    mockRows.invoices = [{
      id: invoiceId,
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
      token: "0xMockToken",
    }];
    mockVerifier.settle.mockResolvedValue("0xtx-e2e");
    mockVerifier.waitForTx.mockResolvedValue({});

    const settleRes = await app.request(`/invoices/${invoiceId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          to: "0x0000000000000000000000000000000000000000",
          value: "100000",
          validAfter: 0,
          validBefore: 9999999999,
          nonce: correctNonce,
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });
    expect(settleRes.status).toBe(200);
    const settleBody = await settleRes.json() as Record<string, unknown>;
    expect(settleBody.verified).toBe(true);
    expect(settleBody.txHash).toBe("0xtx-e2e");

    // Step 5: Re-fetch premium data with paid invoice ID
    mockRows.invoices = [{ id: invoiceId, status: "paid", endpoint: "/data/premium" }];
    const dataRes = await app.request("/data/premium", {
      headers: { "x-payment-invoice-id": invoiceId },
    });
    expect(dataRes.status).toBe(200);
    const data = await dataRes.json() as Record<string, unknown>;
    expect(data.data).toBe("premium");
  });

  it("rejects settlement with wrong nonce (authorization bound to different invoice)", async () => {
    const invoiceId = "inv-bound-test";
    mockRows.invoices = [{
      id: invoiceId,
      status: "pending",
      expiry: String(Math.floor(Date.now() / 1000) + 300),
      endpoint: "/data/premium",
      amount: "100000",
    }];

    // Use a nonce derived from a DIFFERENT invoice ID
    const wrongNonce = hashNonce("inv-other-invoice");

    const res = await app.request(`/invoices/${invoiceId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          to: "0x0000000000000000000000000000000000000000",
          value: "100000",
          validAfter: 0,
          validBefore: 9999999999,
          nonce: wrongNonce,
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("nonce does not match");

    // Verify settle was never called on-chain (gas saved)
    expect(mockVerifier.settle).not.toHaveBeenCalled();
  });
});

// ─── Per-Endpoint Escrow Duration Tests ───

describe("Per-Endpoint Escrow Duration", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSettleRateLimit();
    mockRows.pricing = [];
    mockRows.invoices = [];
    app = createTestApp();
  });

  it("should include escrow_duration in 402 challenge invoice", async () => {
    mockRows.pricing = [{ price: "100000", token: "0xMockToken", description: "Premium", escrow_duration: 3600 }];

    const res = await app.request("/data/premium");
    expect(res.status).toBe(402);

    // The invoice INSERT should include escrow_duration in the template
    const insertCall = sqlMock.mock.calls.find(
      (call: unknown[]) => String((call as unknown[])[0]).includes("INSERT INTO invoices")
    );
    expect(insertCall).toBeDefined();
    // Tagged template: first arg is TemplateStringsArray, rest are values
    const templateStr = String(insertCall![0]);
    expect(templateStr).toContain("escrow_duration");
  });

  it("should pass escrow_duration from invoice to verifier.settle()", async () => {
    // Set up a paid invoice with escrow_duration
    const invoiceId = "test-escrow-settle-id";
    const nonce = hashNonce(invoiceId);
    mockRows.invoices = [{
      id: invoiceId,
      endpoint: "/data/premium",
      amount: "100000",
      token: "0xMockToken",
      nonce,
      expiry: Math.floor(Date.now() / 1000) + 600,
      status: "pending",
      escrow_duration: 3600,
    }];
    mockVerifier.settle.mockResolvedValue("0xsettletxhash");
    mockVerifier.waitForTx.mockResolvedValue({});

    const res = await app.request(`/invoices/${invoiceId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x1111111111111111111111111111111111111111",
          to: mockConfig.contractAddress,
          value: "100000",
          validAfter: 0,
          validBefore: 9999999999,
          nonce,
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });

    expect(res.status).toBe(200);
    // Verify settle was called with escrowDuration=3600
    expect(mockVerifier.settle).toHaveBeenCalledWith(
      invoiceId,
      mockConfig.tokenAddress,
      "/data/premium",
      expect.any(Object),
      undefined,
      3600
    );
  });

  it("should accept escrow_duration in PUT /admin/pricing", async () => {
    const res = await app.request("/admin/pricing/data/premium", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": "test-admin-key-123",
      },
      body: JSON.stringify({
        price: "200000",
        escrow_duration: 7200,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.escrow_duration).toBe(7200);
  });

  it("should reject invalid escrow_duration in PUT /admin/pricing", async () => {
    const res = await app.request("/admin/pricing/data/premium", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": "test-admin-key-123",
      },
      body: JSON.stringify({
        price: "200000",
        escrow_duration: 3000000, // > 30 days
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("escrow_duration");
  });

  it("should schedule auto-release with correct delay after settlement", async () => {
    const invoiceId = "test-autorelease-id";
    const nonce = hashNonce(invoiceId);
    const releaseAtTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    mockRows.invoices = [{
      id: invoiceId,
      endpoint: "/data/premium",
      amount: "100000",
      token: "0xMockToken",
      nonce,
      expiry: Math.floor(Date.now() / 1000) + 600,
      status: "pending",
      escrow_duration: 3600,
    }];
    mockVerifier.settle.mockResolvedValue("0xsettletxhash");
    mockVerifier.waitForTx.mockResolvedValue({});
    mockVerifier.getPayment.mockResolvedValue({ releaseAt: BigInt(releaseAtTimestamp) });

    const res = await app.request(`/invoices/${invoiceId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization: {
          from: "0x1111111111111111111111111111111111111111",
          to: mockConfig.contractAddress,
          value: "100000",
          validAfter: 0,
          validBefore: 9999999999,
          nonce,
          v: 27, r: "0x1234", s: "0x5678",
        },
      }),
    });

    expect(res.status).toBe(200);
    // Verify escrow release was scheduled
    expect(mockScheduleEscrowRelease).toHaveBeenCalledWith(
      invoiceId,
      expect.any(Number)
    );
    // The delay should be approximately 3600*1000 ms (within a few seconds)
    const actualDelay = mockScheduleEscrowRelease.mock.calls[0][1];
    expect(actualDelay).toBeGreaterThan(3500000);
    expect(actualDelay).toBeLessThan(3700000);
  });
});
