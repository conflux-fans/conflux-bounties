import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the module-level constant so apiFetch uses our mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Dynamic import so the module picks up our stubbed fetch
async function getApiFetch() {
  // Clear module cache to re-evaluate with current fetch stub
  const mod = await import("@/lib/api");
  return mod.apiFetch;
}

describe("apiFetch", () => {
  it("sets x-payment-payer header when payer option is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });

    const apiFetch = await getApiFetch();
    await apiFetch("/data/free", { payer: "0xABCD1234" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["x-payment-payer"]).toBe("0xABCD1234");
  });

  it("sets x-payment-invoice-id header when invoiceId option is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });

    const apiFetch = await getApiFetch();
    await apiFetch("/data/premium", { invoiceId: "inv-123" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["x-payment-invoice-id"]).toBe("inv-123");
  });

  it("does not set payment headers when no payer/invoiceId provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const apiFetch = await getApiFetch();
    await apiFetch("/data/free");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["x-payment-payer"]).toBeUndefined();
    expect(options.headers["x-payment-invoice-id"]).toBeUndefined();
  });

  it("handles 402 responses by returning paymentRequired with challenge data", async () => {
    const challengeBody = {
      "x-payment-amount": "100000",
      "x-payment-token": "0xTokenAddr",
      "x-payment-nonce": "uuid-nonce",
      "x-payment-expiry": "1700000000",
      "x-payment-endpoint": "/data/premium",
      "x-payment-invoice-id": "inv-402",
      "x-payment-description": "Premium data",
      "x-payment-recipient": "0xRecipient",
    };

    const headers = new Map<string, string>();
    // Simulate headers.get returning null (so body fallback is used)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      headers: {
        get: (name: string) => headers.get(name) ?? null,
      },
      json: async () => challengeBody,
    });

    const apiFetch = await getApiFetch();
    const result = await apiFetch("/data/premium");

    expect(result.status).toBe(402);
    expect(result.paymentRequired).toBeDefined();
    expect(result.paymentRequired!.amount).toBe("100000");
    expect(result.paymentRequired!.token).toBe("0xTokenAddr");
    expect(result.paymentRequired!.nonce).toBe("uuid-nonce");
    expect(result.paymentRequired!.expiry).toBe(1700000000);
    expect(result.paymentRequired!.endpoint).toBe("/data/premium");
    expect(result.paymentRequired!.invoiceId).toBe("inv-402");
    expect(result.paymentRequired!.description).toBe("Premium data");
    expect(result.paymentRequired!.recipient).toBe("0xRecipient");
  });

  it("handles 402 responses using response headers when present", async () => {
    const responseHeaders = new Map<string, string>([
      ["x-payment-amount", "500000"],
      ["x-payment-token", "0xFromHeader"],
      ["x-payment-nonce", "header-nonce"],
      ["x-payment-expiry", "1800000000"],
      ["x-payment-endpoint", "/compute/simulate"],
      ["x-payment-invoice-id", "inv-header"],
      ["x-payment-description", "Compute job"],
      ["x-payment-recipient", "0xHeaderRecipient"],
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      headers: {
        get: (name: string) => responseHeaders.get(name) ?? null,
      },
      json: async () => ({}),
    });

    const apiFetch = await getApiFetch();
    const result = await apiFetch("/compute/simulate", { method: "POST" });

    expect(result.status).toBe(402);
    expect(result.paymentRequired!.amount).toBe("500000");
    expect(result.paymentRequired!.token).toBe("0xFromHeader");
    expect(result.paymentRequired!.recipient).toBe("0xHeaderRecipient");
  });

  it("returns error for non-402 failure responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const apiFetch = await getApiFetch();
    const result = await apiFetch("/data/free");

    expect(result.status).toBe(500);
    expect(result.error).toBe("Internal server error");
    expect(result.data).toBeUndefined();
  });
});
