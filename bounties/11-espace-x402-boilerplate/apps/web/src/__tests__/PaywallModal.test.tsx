import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PaywallModal } from "@/components/PaywallModal";
import type { PaymentChallenge } from "@/lib/api";

// ─── Mock wagmi hooks ───────────────────────────────────────────
const mockUseAccount = vi.fn();
const mockUseWalletClient = vi.fn();
const mockUseChainId = vi.fn();
const mockUseReadContract = vi.fn();
const mockUseBalance = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useChainId: () => mockUseChainId(),
  useReadContract: () => mockUseReadContract(),
  useBalance: () => mockUseBalance(),
}));

// ─── Mock @x402/shared ──────────────────────────────────────────
vi.mock("@x402/shared", () => ({
  TOKEN_DECIMALS: 6,
  RECEIVE_WITH_AUTHORIZATION_TYPES: {
    ReceiveWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  },
  ERC3009_DOMAIN: { name: "USD Tether 0", version: "1" },
  getERC3009Domain: () => ({ name: "USD Tether 0", version: "1" }),
  splitSignature: (sig: string) => ({
    v: 27,
    r: "0x" + "aa".repeat(32),
    s: "0x" + "bb".repeat(32),
  }),
  hashNonce: (nonce: string) => "0x" + "cc".repeat(32),
  tokenSymbol: (address?: string) => "USDT0",
}));

// ─── Helpers ────────────────────────────────────────────────────

function makeChallenge(overrides?: Partial<PaymentChallenge>): PaymentChallenge {
  return {
    amount: "100000", // 0.10 USDT0
    token: "0xTokenAddress",
    nonce: "test-nonce-uuid",
    expiry: Math.floor(Date.now() / 1000) + 300,
    endpoint: "/data/premium",
    invoiceId: "inv-test-123",
    description: "Premium analytics",
    recipient: "0xRecipientAddress",
    verifierAddress: "0xVerifierAddress",
    ...overrides,
  };
}

function setupWagmiMocks(overrides?: {
  address?: string;
  walletClient?: unknown;
  chainId?: number;
  tokenBalance?: bigint;
}) {
  const address = overrides?.address ?? "0xUserAddress";
  mockUseAccount.mockReturnValue({ address });
  mockUseWalletClient.mockReturnValue({
    data: overrides?.walletClient ?? { signTypedData: vi.fn() },
  });
  mockUseChainId.mockReturnValue(overrides?.chainId ?? 71);
  mockUseReadContract.mockReturnValue({
    data: overrides?.tokenBalance ?? BigInt(1000000),
  });
  mockUseBalance.mockReturnValue({
    data: { formatted: "10.0000", value: BigInt(10e18) },
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe("PaywallModal", () => {
  const onClose = vi.fn();
  const onPaymentComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupWagmiMocks();
  });

  it("renders the payment dialog with correct amount and token info", () => {
    const challenge = makeChallenge();
    render(
      <PaywallModal
        challenge={challenge}
        onClose={onClose}
        onPaymentComplete={onPaymentComplete}
      />
    );

    // Title
    expect(screen.getByText("Payment Required")).toBeInTheDocument();

    // Amount: 100000 / 10^6 = 0.10 — appears in amount display and button
    const amountMatches = screen.getAllByText(/0\.10/);
    expect(amountMatches.length).toBeGreaterThanOrEqual(1);
    // USDT0 appears multiple times (amount label, balance label, button)
    const usdtMatches = screen.getAllByText(/USDT0/);
    expect(usdtMatches.length).toBeGreaterThanOrEqual(1);

    // Endpoint
    expect(screen.getByText("/data/premium")).toBeInTheDocument();

    // Description
    expect(screen.getByText("Premium analytics")).toBeInTheDocument();

    // Authorize button shows the amount
    expect(screen.getByText("Authorize 0.10 USDT0")).toBeInTheDocument();
  });

  it("throws when challenge.verifierAddress is missing during payment", async () => {
    const challenge = makeChallenge({ verifierAddress: undefined });
    const signTypedData = vi.fn();
    setupWagmiMocks({ walletClient: { signTypedData } });

    render(
      <PaywallModal
        challenge={challenge}
        onClose={onClose}
        onPaymentComplete={onPaymentComplete}
      />
    );

    const payButton = screen.getByText("Authorize 0.10 USDT0");
    fireEvent.click(payButton);

    // The error should be caught and displayed in the UI
    await waitFor(() => {
      expect(
        screen.getByText("Missing verifier contract address in 402 challenge")
      ).toBeInTheDocument();
    });

    // signTypedData should NOT have been called
    expect(signTypedData).not.toHaveBeenCalled();
  });

  it("calls onPaymentComplete with invoiceId and payer address after successful payment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const challenge = makeChallenge();
    const signTypedData = vi.fn().mockResolvedValue("0x" + "ab".repeat(65));
    setupWagmiMocks({ walletClient: { signTypedData } });

    // Mock the settle endpoint
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true, txHash: "0xTxHash123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <PaywallModal
        challenge={challenge}
        onClose={onClose}
        onPaymentComplete={onPaymentComplete}
      />
    );

    const payButton = screen.getByText("Authorize 0.10 USDT0");
    fireEvent.click(payButton);

    // Wait for the signing and settlement to complete
    await waitFor(() => {
      expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
    });

    // signTypedData should have been called
    expect(signTypedData).toHaveBeenCalledTimes(1);

    // The settle API should have been called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/invoices/inv-test-123/settle"),
      expect.objectContaining({ method: "POST" })
    );

    // onPaymentComplete is called after a 1-second setTimeout
    vi.advanceTimersByTime(1100);
    expect(onPaymentComplete).toHaveBeenCalledWith("inv-test-123", "0xUserAddress");

    vi.useRealTimers();
  });

  it("displays error when settlement fails", async () => {
    const challenge = makeChallenge();
    const signTypedData = vi.fn().mockResolvedValue("0x" + "ab".repeat(65));
    setupWagmiMocks({ walletClient: { signTypedData } });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: false, error: "Signature mismatch" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <PaywallModal
        challenge={challenge}
        onClose={onClose}
        onPaymentComplete={onPaymentComplete}
      />
    );

    fireEvent.click(screen.getByText("Authorize 0.10 USDT0"));

    await waitFor(() => {
      expect(screen.getByText("Signature mismatch")).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText("Retry payment")).toBeInTheDocument();
  });

  it("shows insufficient balance warning when token balance is too low", () => {
    const challenge = makeChallenge({ amount: "5000000" }); // 5.00 USDT0
    setupWagmiMocks({ tokenBalance: BigInt(100000) }); // only 0.10

    render(
      <PaywallModal
        challenge={challenge}
        onClose={onClose}
        onPaymentComplete={onPaymentComplete}
      />
    );

    expect(screen.getByText(/Insufficient USDT0 balance/)).toBeInTheDocument();
  });
});
