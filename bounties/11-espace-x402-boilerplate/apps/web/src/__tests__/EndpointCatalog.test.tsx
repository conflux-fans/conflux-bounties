import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EndpointCatalog } from "@/components/EndpointCatalog";

// ─── Mock connectkit (must come before wagmi — connectkit calls createConfig at module level) ──
vi.mock("connectkit", () => ({
  getDefaultConfig: (cfg: any) => cfg,
  ConnectKitProvider: ({ children }: any) => children,
  ConnectKitButton: () => null,
}));

// ─── Mock @/lib/wagmi (imports connectkit at module level) ──────
vi.mock("@/lib/wagmi", () => ({
  wagmiConfig: {},
  getContractAddress: () => undefined,
  getChainById: () => ({ id: 71, name: "Conflux eSpace Testnet" }),
  confluxTestnetChain: { id: 71 },
  confluxMainnetChain: { id: 1030 },
  defaultChain: { id: 71 },
  defaultIsMainnet: false,
}));

// ─── Mock wagmi ─────────────────────────────────────────────────
const mockUseAccount = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => ({ data: null }),
  useChainId: () => 71,
  useReadContract: () => ({ data: undefined }),
  useBalance: () => ({ data: undefined }),
  createConfig: (cfg: any) => cfg,
  http: () => ({}),
}));

// ─── Mock @x402/shared ──────────────────────────────────────────
vi.mock("@x402/shared", () => ({
  TOKEN_DECIMALS: 6,
  USDT0_MAINNET: "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff",
  RECEIVE_WITH_AUTHORIZATION_TYPES: {
    ReceiveWithAuthorization: [],
  },
  ERC3009_DOMAIN: { name: "USD Tether 0", version: "1" },
  splitSignature: () => ({ v: 27, r: "0x", s: "0x" }),
  hashNonce: () => "0x",
  tokenSymbol: () => "USDT0",
}));

// ─── Mock apiFetch ──────────────────────────────────────────────
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ data: { mock: true }, status: 200 }),
}));

// ─── Global fetch mock ──────────────────────────────────────────
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockUseAccount.mockReturnValue({ isConnected: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EndpointCatalog", () => {
  it("fetches pricing from API on mount", async () => {
    const pricingData = {
      pricing: [
        { endpoint: "/data/premium", price: "200000" },
        { endpoint: "/compute/simulate", price: "750000" },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => pricingData,
    });

    render(<EndpointCatalog />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/pricing")
      );
    });

    // Prices should be updated from the API response
    // 200000 / 10^6 = 0.20 USDT0
    await waitFor(() => {
      expect(screen.getByText("0.20 USDT0")).toBeInTheDocument();
    });
    // 750000 / 10^6 = 0.75 USDT0
    expect(screen.getByText("0.75 USDT0")).toBeInTheDocument();
  });

  it("falls back to default prices when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<EndpointCatalog />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Default prices should still be shown
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("0.10 USDT0")).toBeInTheDocument();
    expect(screen.getByText("0.50 USDT0")).toBeInTheDocument();
  });

  it("falls back to defaults when fetch returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<EndpointCatalog />);

    // Defaults should render
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("0.10 USDT0")).toBeInTheDocument();
    expect(screen.getByText("0.50 USDT0")).toBeInTheDocument();
  });

  it("renders endpoint cards with correct paths, methods, and descriptions", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<EndpointCatalog />);

    // Endpoint paths
    expect(screen.getByText("/data/free")).toBeInTheDocument();
    expect(screen.getByText("/data/instant")).toBeInTheDocument();
    expect(screen.getByText("/data/premium")).toBeInTheDocument();
    expect(screen.getByText("/compute/simulate")).toBeInTheDocument();

    // Methods
    const getMethods = screen.getAllByText("GET");
    expect(getMethods).toHaveLength(3); // /data/free, /data/instant, /data/premium
    expect(screen.getByText("POST")).toBeInTheDocument();

    // Descriptions
    expect(
      screen.getByText(/Basic network metrics including TPS/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quick price and network lookup/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Detailed analytics with historical trends/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Run a compute simulation/)
    ).toBeInTheDocument();
  });

  it("renders 'Try it' buttons for each endpoint when connected", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<EndpointCatalog />);

    const tryButtons = screen.getAllByText("Try it");
    expect(tryButtons).toHaveLength(4);
  });

  it("shows 'Connect wallet first' for premium endpoints when disconnected", async () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<EndpointCatalog />);

    const connectMessages = screen.getAllByText("Connect wallet first");
    // Three premium endpoints should show connect message
    expect(connectMessages).toHaveLength(3);

    // Free endpoint should still be clickable
    expect(screen.getByText("Try it")).toBeInTheDocument();
  });
});
