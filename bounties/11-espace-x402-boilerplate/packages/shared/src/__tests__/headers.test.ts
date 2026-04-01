import { describe, it, expect } from "vitest";
import { buildPaymentHeaders, parsePaymentHeaders, splitSignature } from "../headers.js";

describe("buildPaymentHeaders", () => {
  it("should build all required headers", () => {
    const headers = buildPaymentHeaders({
      amount: "100000",
      token: "0xTokenAddress",
      nonce: "test-nonce",
      expiry: 1700000000,
      endpoint: "/data/premium",
      invoiceId: "inv-123",
    });

    expect(headers["x-payment-amount"]).toBe("100000");
    expect(headers["x-payment-token"]).toBe("0xTokenAddress");
    expect(headers["x-payment-nonce"]).toBe("test-nonce");
    expect(headers["x-payment-expiry"]).toBe("1700000000");
    expect(headers["x-payment-endpoint"]).toBe("/data/premium");
    expect(headers["x-payment-invoice-id"]).toBe("inv-123");
  });

  it("should include optional description when provided", () => {
    const headers = buildPaymentHeaders({
      amount: "100000",
      token: "0xToken",
      nonce: "n",
      expiry: 1700000000,
      endpoint: "/test",
      invoiceId: "inv-1",
      description: "Premium data access",
    });

    expect(headers["x-payment-description"]).toBe("Premium data access");
  });

  it("should include optional recipient when provided", () => {
    const headers = buildPaymentHeaders({
      amount: "100000",
      token: "0xToken",
      nonce: "n",
      expiry: 1700000000,
      endpoint: "/test",
      invoiceId: "inv-1",
      recipient: "0xRecipient",
    });

    expect(headers["x-payment-recipient"]).toBe("0xRecipient");
  });

  it("should omit optional headers when not provided", () => {
    const headers = buildPaymentHeaders({
      amount: "100000",
      token: "0xToken",
      nonce: "n",
      expiry: 1700000000,
      endpoint: "/test",
      invoiceId: "inv-1",
    });

    expect(headers["x-payment-description"]).toBeUndefined();
    expect(headers["x-payment-recipient"]).toBeUndefined();
  });
});

describe("parsePaymentHeaders", () => {
  it("should parse headers into a payment challenge", () => {
    const challenge = parsePaymentHeaders({
      "x-payment-amount": "500000",
      "x-payment-token": "0xUSDT0",
      "x-payment-nonce": "uuid-nonce",
      "x-payment-expiry": "1700000000",
      "x-payment-endpoint": "/compute/simulate",
      "x-payment-invoice-id": "inv-456",
      "x-payment-recipient": "0xSeller",
    });

    expect(challenge.amount).toBe("500000");
    expect(challenge.token).toBe("0xUSDT0");
    expect(challenge.nonce).toBe("uuid-nonce");
    expect(challenge.expiry).toBe(1700000000);
    expect(challenge.endpoint).toBe("/compute/simulate");
    expect(challenge.invoiceId).toBe("inv-456");
    expect(challenge.recipient).toBe("0xSeller");
  });

  it("should round-trip with buildPaymentHeaders", () => {
    const original = {
      amount: "100000",
      token: "0xToken",
      nonce: "nonce-1",
      expiry: 1700000000,
      endpoint: "/data/premium",
      invoiceId: "inv-rt",
      description: "Test",
      recipient: "0xRecipient",
    };

    const headers = buildPaymentHeaders(original);
    const parsed = parsePaymentHeaders(headers);

    expect(parsed.amount).toBe(original.amount);
    expect(parsed.token).toBe(original.token);
    expect(parsed.nonce).toBe(original.nonce);
    expect(parsed.expiry).toBe(original.expiry);
    expect(parsed.endpoint).toBe(original.endpoint);
    expect(parsed.invoiceId).toBe(original.invoiceId);
    expect(parsed.description).toBe(original.description);
    expect(parsed.recipient).toBe(original.recipient);
  });
});

describe("splitSignature", () => {
  it("should correctly split a 65-byte hex signature", () => {
    // Known test vector: 32 bytes r + 32 bytes s + 1 byte v
    const r = "a".repeat(64);
    const s = "b".repeat(64);
    const vHex = "1b"; // v = 27
    const signature = `0x${r}${s}${vHex}`;

    const result = splitSignature(signature);

    expect(result.r).toBe(`0x${r}`);
    expect(result.s).toBe(`0x${s}`);
    expect(result.v).toBe(27);
  });

  it("should handle v = 28", () => {
    const r = "1".repeat(64);
    const s = "2".repeat(64);
    const signature = `0x${r}${s}1c`; // v = 28

    const result = splitSignature(signature);
    expect(result.v).toBe(28);
  });

  it("should handle a realistic EIP-712 signature", () => {
    // Simulated real signature (130 hex chars after 0x = 65 bytes)
    const r = "c9b1a9c5a92d4b5e8f3c6d7a2b1e0f4c8d9a5b6e7f3c2d1a0b9e8f7c6d5a4b3a"; // 64 hex chars
    const s = "2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b"; // 64 hex chars
    const sig = `0x${r}${s}1b`; // v = 27

    const result = splitSignature(sig);
    expect(result.r).toBe(`0x${r}`);
    expect(result.s).toBe(`0x${s}`);
    expect(result.v).toBe(27);
  });
});
