const mockReadContract = jest.fn();

jest.mock("viem", () => {
  const actual = jest.requireActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      readContract: (...args: unknown[]) => mockReadContract(...args),
    })),
    http: jest.fn(() => ({})),
  };
});

import type { Address } from "viem";
import { evaluateCondition, evaluateRulesJson } from "./evaluate";

const wallet = "0x1111111111111111111111111111111111111111" as Address;
const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

describe("evaluateCondition", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  it("returns false for unsupported chain", async () => {
    const ok = await evaluateCondition(wallet, {
      type: "ERC20",
      chainId: 999999,
      address: token,
      minBalance: "1",
    });
    expect(ok).toBe(false);
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("ERC20: true when balance meets minBalance", async () => {
    mockReadContract.mockResolvedValueOnce(10n);
    const ok = await evaluateCondition(wallet, {
      type: "ERC20",
      chainId: 1030,
      address: token,
      minBalance: "5",
    });
    expect(ok).toBe(true);
  });

  it("ERC20: false when readContract throws", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("revert"));
    const ok = await evaluateCondition(wallet, {
      type: "ERC20",
      chainId: 1030,
      address: token,
      minBalance: "1",
    });
    expect(ok).toBe(false);
  });

  it("ERC721: true when owner matches wallet", async () => {
    mockReadContract.mockResolvedValueOnce(wallet);
    const ok = await evaluateCondition(wallet, {
      type: "ERC721",
      chainId: 1030,
      address: token,
      tokenId: "42",
    });
    expect(ok).toBe(true);
  });

  it("ERC1155: true when balance meets minQuantity", async () => {
    mockReadContract.mockResolvedValueOnce(3n);
    const ok = await evaluateCondition(wallet, {
      type: "ERC1155",
      chainId: 1030,
      address: token,
      tokenId: "1",
      minQuantity: "2",
    });
    expect(ok).toBe(true);
  });
});

describe("evaluateRulesJson", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  it("ALL requires every condition", async () => {
    mockReadContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(0n);
    const rules = {
      conditions: [
        { type: "ERC20" as const, chainId: 1030, address: token, minBalance: "1" },
        {
          type: "ERC20" as const,
          chainId: 1030,
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          minBalance: "1",
        },
      ],
    };
    const ok = await evaluateRulesJson(wallet, rules, "ALL");
    expect(ok).toBe(false);
  });

  it("ANY passes if one condition passes", async () => {
    mockReadContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(5n);
    const rules = {
      conditions: [
        { type: "ERC20" as const, chainId: 1030, address: token, minBalance: "10" },
        {
          type: "ERC20" as const,
          chainId: 1030,
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          minBalance: "1",
        },
      ],
    };
    const ok = await evaluateRulesJson(wallet, rules, "ANY");
    expect(ok).toBe(true);
  });
});
