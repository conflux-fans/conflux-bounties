import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig } from "../agent.js";

// ── Mock @x402/sdk ──────────────────────────────────────────────────────────
const mockSignAuthorization = vi.fn();
const mockSubmitAuthorization = vi.fn();

vi.mock("@x402/sdk", () => ({
  X402Client: vi.fn().mockImplementation(() => ({
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    signAuthorization: mockSignAuthorization,
    submitAuthorization: mockSubmitAuthorization,
  })),
}));

// ── Mock the store so constructor doesn't touch SQLite ───────────────────────
vi.mock("../store.js", () => ({
  AgentStore: vi.fn().mockImplementation(() => ({
    getMemory: vi.fn().mockReturnValue(null),
    setMemory: vi.fn(),
    createSession: vi.fn(),
    endSession: vi.fn(),
    recordTransaction: vi.fn(),
    getRecentSessions: vi.fn().mockReturnValue([]),
    close: vi.fn(),
  })),
}));

// ── Import after mocks are registered ────────────────────────────────────────
import { X402Agent } from "../agent.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DUMMY_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    apiBase: "http://localhost:4000",
    privateKey: DUMMY_KEY as `0x${string}`,
    contractAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    rpcUrl: "https://evmtestnet.confluxrpc.com",
    spendCap: "10000000",   // 10 USDT0
    dailyBudget: "5000000",  // 5 USDT0
    pollIntervalMs: 5000,
    maxRetries: 3,
    ...overrides,
  };
}

/** Build a minimal 402 challenge body/headers. */
function make402Headers(amount = "100000") {
  return {
    "x-payment-amount": amount,
    "x-payment-token": "0xTokenAddress",
    "x-payment-nonce": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "x-payment-expiry": String(Math.floor(Date.now() / 1000) + 3600),
    "x-payment-endpoint": "/premium",
    "x-payment-invoice-id": "inv-001",
    "x-payment-recipient": "0xRecipientAddress",
  };
}

/** Create a mock Response object. */
function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const headersMap = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersMap,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

const SIGNED_AUTH = {
  from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  to: "0xRecipientAddress",
  value: "100000",
  validAfter: 0,
  validBefore: 9999999999,
  nonce: "0xabcdef",
  v: 27,
  r: "0x1111",
  s: "0x2222",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("X402Agent.callEndpoint", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockSignAuthorization.mockReset();
    mockSubmitAuthorization.mockReset();
  });

  // 1. 200 OK passthrough
  it("returns data when endpoint returns 200 OK", async () => {
    const agent = new X402Agent(makeConfig());
    const payload = { result: "hello" };

    fetchSpy.mockResolvedValueOnce(mockResponse(200, payload));

    const data = await agent.callEndpoint("/free");
    expect(data).toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 2. 402 → sign → settle → retry success
  it("handles 402 by signing auth, settling, then retrying successfully", async () => {
    const agent = new X402Agent(makeConfig());
    const challengeHeaders = make402Headers();
    const premiumData = { premium: true, data: [1, 2, 3] };

    // First call: 402 with challenge
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    // Pause status check (not paused)
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));

    // After settlement, retry returns 200
    fetchSpy.mockResolvedValueOnce(mockResponse(200, premiumData));

    mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
    mockSubmitAuthorization.mockResolvedValueOnce({ verified: true, txHash: "0xabc123" });

    const data = await agent.callEndpoint("/premium");

    expect(data).toEqual(premiumData);
    expect(mockSignAuthorization).toHaveBeenCalledTimes(1);
    expect(mockSubmitAuthorization).toHaveBeenCalledTimes(1);
    // Three fetch calls: initial 402 + pause check + retry after settlement
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Verify retry includes invoice headers (index 2: 402, pause, retry)
    const retryCall = fetchSpy.mock.calls[2];
    const retryOpts = retryCall[1] as RequestInit;
    const retryHeaders = retryOpts.headers as Record<string, string>;
    expect(retryHeaders["x-payment-invoice-id"]).toBe("inv-001");
    expect(retryHeaders["x-payment-payer"]).toBe(SIGNED_AUTH.from);
  });

  // 3. Spend cap exceeded
  it("throws when 402 amount exceeds spend cap", async () => {
    // Set a very low cap (0.05 USDT0)
    const agent = new X402Agent(makeConfig({ spendCap: "50000", dailyBudget: "50000" }));
    const challengeHeaders = make402Headers("100000"); // 0.10 USDT0 > cap

    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    // Pause status check (not paused)
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));

    await expect(agent.callEndpoint("/expensive")).rejects.toThrow("Spend cap exceeded");
    expect(mockSignAuthorization).not.toHaveBeenCalled();
  });

  // 4. Settlement failure triggers retry of the outer loop
  it("retries outer loop when settlement returns verified=false", async () => {
    const agent = new X402Agent(makeConfig());
    const challengeHeaders = make402Headers();
    const premiumData = { premium: true };

    // Attempt 0: 402 → pause check → settlement fails
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));
    mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
    mockSubmitAuthorization.mockResolvedValueOnce({ verified: false });

    // Attempt 1: 402 again → pause check → settlement succeeds → retry 200
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));
    mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
    mockSubmitAuthorization.mockResolvedValueOnce({ verified: true, txHash: "0xdef456" });
    fetchSpy.mockResolvedValueOnce(mockResponse(200, premiumData));

    const data = await agent.callEndpoint("/premium");

    expect(data).toEqual(premiumData);
    expect(mockSignAuthorization).toHaveBeenCalledTimes(2);
    expect(mockSubmitAuthorization).toHaveBeenCalledTimes(2);
    // fetch calls: 402 + pause (attempt 0) + 402 + pause (attempt 1) + retry 200
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  // 5. Max retries exceeded
  it("throws after maxRetries attempts all fail", async () => {
    const agent = new X402Agent(makeConfig({ maxRetries: 2 }));
    const challengeHeaders = make402Headers();

    // All 3 attempts (0, 1, 2) return 402 with settlement failure
    for (let i = 0; i < 3; i++) {
      fetchSpy.mockResolvedValueOnce(
        mockResponse(402, challengeHeaders, challengeHeaders),
      );
      // Pause status check (not paused)
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));
      mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
      mockSubmitAuthorization.mockResolvedValueOnce({ verified: false });
    }

    await expect(agent.callEndpoint("/premium")).rejects.toThrow("Max retries exceeded");
    expect(mockSignAuthorization).toHaveBeenCalledTimes(3);
    expect(mockSubmitAuthorization).toHaveBeenCalledTimes(3);
    // fetch calls: 3 × (402 + pause check) = 6
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  // 6. Daily budget exceeded on second payment
  it("rejects second payment when daily budget would be exceeded", async () => {
    // Daily budget = 1 USDT0 (1_000_000 units). Two payments of 0.60 USDT0 (600_000) each.
    const agent = new X402Agent(makeConfig({ spendCap: "10000000", dailyBudget: "1000000" }));
    const challengeHeaders = make402Headers("600000"); // 0.60 USDT0
    const premiumData = { premium: true };

    // First call: 402 → pause check → sign → settle (verified) → retry 200 OK
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));
    mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
    mockSubmitAuthorization.mockResolvedValueOnce({ verified: true, txHash: "0xfirst" });
    fetchSpy.mockResolvedValueOnce(mockResponse(200, premiumData));

    const firstResult = await agent.callEndpoint("/premium");
    expect(firstResult).toEqual(premiumData);

    // Second call: 402 → pause check → canSpend returns false → throws
    const challengeHeaders2 = make402Headers("600000");
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders2, challengeHeaders2),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));

    await expect(agent.callEndpoint("/premium")).rejects.toThrow("Spend cap exceeded");
    // Second call should never reach signing
    expect(mockSignAuthorization).toHaveBeenCalledTimes(1);
  });

  // 7. Admin pause stops payment
  it("throws when agent is paused by admin during 402 handling", async () => {
    const agent = new X402Agent(makeConfig());
    const challengeHeaders = make402Headers("100000");

    // First fetch: 402 challenge
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    // Pause status check: agent is paused
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { paused: true, reason: "maintenance window" }),
    );

    await expect(agent.callEndpoint("/premium")).rejects.toThrow(
      "Agent paused by admin: maintenance window",
    );
    // Should never reach signing since pause check comes first
    expect(mockSignAuthorization).not.toHaveBeenCalled();
    expect(mockSubmitAuthorization).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // 8. Zero budget effectively pauses the agent
  it("rejects all payments when daily budget is set to zero", async () => {
    const agent = new X402Agent(makeConfig({ dailyBudget: "0" }));
    const challengeHeaders = make402Headers("100000"); // Any non-zero amount

    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    // Pause status check (not paused)
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));

    await expect(agent.callEndpoint("/premium")).rejects.toThrow("Spend cap exceeded");
    expect(mockSignAuthorization).not.toHaveBeenCalled();
  });

  // 9. Retry exhaustion with persistent 402 responses after successful settlements
  it("gives up after max retries when paid retries keep returning 402", async () => {
    const agent = new X402Agent(makeConfig({ maxRetries: 2 }));
    const challengeHeaders = make402Headers("100000");

    // All 3 attempts (0, 1, 2): 402 → pause check → sign → settle OK → retry also returns 402
    for (let i = 0; i < 3; i++) {
      // Initial 402
      fetchSpy.mockResolvedValueOnce(
        mockResponse(402, challengeHeaders, challengeHeaders),
      );
      // Pause check
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));
      // Settlement succeeds
      mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
      mockSubmitAuthorization.mockResolvedValueOnce({ verified: true, txHash: `0xhash${i}` });
      // Retry after payment still returns 402 (persistent paywall)
      fetchSpy.mockResolvedValueOnce(
        mockResponse(402, challengeHeaders, challengeHeaders),
      );
    }

    await expect(agent.callEndpoint("/premium")).rejects.toThrow(
      "Max retries exceeded for /premium",
    );
    // Each attempt goes through signing and settlement
    expect(mockSignAuthorization).toHaveBeenCalledTimes(3);
    expect(mockSubmitAuthorization).toHaveBeenCalledTimes(3);
    // fetch calls: 3 × (initial 402 + pause check + retry 402) = 9
    expect(fetchSpy).toHaveBeenCalledTimes(9);
  });

  // 10. Network error
  it("throws a descriptive error when fetch fails", async () => {
    const agent = new X402Agent(makeConfig());

    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(agent.callEndpoint("/any")).rejects.toThrow(
      "Network error calling /any: ECONNREFUSED",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 11. Sub-30s retry benchmark (spec: 402 → pay → retry within 30s)
  it("completes 402 → sign → settle → retry cycle in under 30 seconds", async () => {
    const agent = new X402Agent(makeConfig());
    const challengeHeaders = make402Headers();
    const premiumData = { premium: true, data: [1, 2, 3] };

    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, challengeHeaders, challengeHeaders),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { paused: false }));
    fetchSpy.mockResolvedValueOnce(mockResponse(200, premiumData));

    mockSignAuthorization.mockResolvedValueOnce(SIGNED_AUTH);
    mockSubmitAuthorization.mockResolvedValueOnce({ verified: true, txHash: "0xtiming" });

    const start = performance.now();
    const data = await agent.callEndpoint("/premium");
    const elapsed = performance.now() - start;

    expect(data).toEqual(premiumData);
    expect(elapsed).toBeLessThan(30_000);
  });
});
