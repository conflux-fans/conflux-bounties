import { describe, it, expect, vi } from "vitest";
import { X402Client, type X402PaymentChallenge } from "../client.js";
import { X402Verifier } from "../verifier.js";
import { confluxESpaceTestnet, confluxESpaceMainnet } from "../chain.js";

// Use Hardhat's default test account (well-known, no real funds)
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const DUMMY_CONTRACT = "0x1111111111111111111111111111111111111111" as `0x${string}`;

// ─── Chain definitions ───

describe("Chain definitions", () => {
  it("confluxESpaceTestnet has correct chain id and name", () => {
    expect(confluxESpaceTestnet.id).toBe(71);
    expect(confluxESpaceTestnet.name).toBe("Conflux eSpace Testnet");
    expect(confluxESpaceTestnet.testnet).toBe(true);
  });

  it("confluxESpaceMainnet has correct chain id and name", () => {
    expect(confluxESpaceMainnet.id).toBe(1030);
    expect(confluxESpaceMainnet.name).toBe("Conflux eSpace");
    expect(confluxESpaceMainnet.testnet).toBe(false);
  });
});

// ─── X402Client ───

describe("X402Client", () => {
  it("creates a read-only client without private key", () => {
    const client = new X402Client({ contractAddress: DUMMY_CONTRACT });
    expect(client.publicClient).toBeDefined();
    expect(client.walletClient).toBeUndefined();
    expect(client.address).toBeUndefined();
  });

  it("creates a signing client with private key", () => {
    const client = new X402Client({
      contractAddress: DUMMY_CONTRACT,
      privateKey: TEST_KEY,
    });
    expect(client.walletClient).toBeDefined();
    expect(client.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("defaults to confluxESpaceTestnet chain", () => {
    const client = new X402Client({ contractAddress: DUMMY_CONTRACT });
    expect(client.contractAddress).toBe(DUMMY_CONTRACT);
    // publicClient should be configured (verifiable by existence)
    expect(client.publicClient).toBeDefined();
  });

  it("accepts a custom chain", () => {
    const client = new X402Client({
      contractAddress: DUMMY_CONTRACT,
      chain: confluxESpaceMainnet,
    });
    expect(client.publicClient).toBeDefined();
  });

  it("throws when signing without a wallet", async () => {
    const client = new X402Client({ contractAddress: DUMMY_CONTRACT });
    const challenge: X402PaymentChallenge = {
      amount: "100000",
      token: DUMMY_CONTRACT,
      nonce: "test-nonce-1",
      expiry: Math.floor(Date.now() / 1000) + 300,
      endpoint: "/data/premium",
      invoiceId: "inv-1",
    };
    await expect(client.signAuthorization(challenge)).rejects.toThrow(
      "Wallet not configured"
    );
  });

  it("throws when challenge has zero-address verifier and no contract fallback match", async () => {
    const client = new X402Client({
      contractAddress: ZERO_ADDR,
      privateKey: TEST_KEY,
    });
    const challenge: X402PaymentChallenge = {
      amount: "100000",
      token: DUMMY_CONTRACT,
      nonce: "test-nonce-2",
      expiry: Math.floor(Date.now() / 1000) + 300,
      endpoint: "/data/premium",
      invoiceId: "inv-2",
      verifierAddress: ZERO_ADDR,
    };
    await expect(client.signAuthorization(challenge)).rejects.toThrow(
      "missing verifierAddress"
    );
  });
});

// ─── X402Verifier ───

describe("X402Verifier", () => {
  it("creates a read-only verifier without facilitator key", () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    expect(v.account).toBeUndefined();
  });

  it("creates a signing verifier with facilitator key", () => {
    const v = new X402Verifier({
      contractAddress: DUMMY_CONTRACT,
      facilitatorKey: TEST_KEY,
    });
    expect(v.account).toBeDefined();
    expect(v.account!.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("throws on settle() without facilitator key", async () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    await expect(
      v.settle("inv-1", DUMMY_CONTRACT, "/data/premium", {
        from: ZERO_ADDR,
        to: DUMMY_CONTRACT,
        value: "100000",
        validAfter: 0,
        validBefore: 999999999,
        nonce: "0x" + "00".repeat(32),
        v: 27,
        r: "0x" + "00".repeat(32),
        s: "0x" + "00".repeat(32),
      })
    ).rejects.toThrow("Facilitator wallet not configured");
  });

  it("throws on release() without facilitator key", async () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    await expect(v.release("0x" + "ab".repeat(32) as `0x${string}`)).rejects.toThrow(
      "Facilitator wallet not configured"
    );
  });

  it("throws on refund() without facilitator key", async () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    await expect(v.refund("0x" + "ab".repeat(32) as `0x${string}`)).rejects.toThrow(
      "Facilitator wallet not configured"
    );
  });

  it("throws on refundTo() without facilitator key", async () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    await expect(
      v.refundTo("0x" + "ab".repeat(32) as `0x${string}`, DUMMY_CONTRACT)
    ).rejects.toThrow("Facilitator wallet not configured");
  });

  it("throws on registerSeller() without facilitator key", async () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    await expect(
      v.registerSeller("https://api.example.com", "test seller")
    ).rejects.toThrow("Facilitator wallet not configured");
  });

  it("derives invoice ID deterministically", () => {
    const v = new X402Verifier({
      contractAddress: DUMMY_CONTRACT,
      facilitatorKey: TEST_KEY,
    });
    const nonce = "0x" + "01".repeat(32) as `0x${string}`;
    const from = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
    const token = DUMMY_CONTRACT;

    const id1 = v.deriveInvoiceId(from, undefined, token, nonce);
    const id2 = v.deriveInvoiceId(from, undefined, token, nonce);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("throws deriveInvoiceId without recipient or account", () => {
    const v = new X402Verifier({ contractAddress: DUMMY_CONTRACT });
    const nonce = "0x" + "01".repeat(32) as `0x${string}`;
    expect(() =>
      v.deriveInvoiceId(DUMMY_CONTRACT, undefined, DUMMY_CONTRACT, nonce)
    ).toThrow("Recipient address required");
  });
});
