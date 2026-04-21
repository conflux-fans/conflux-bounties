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

jest.mock("@/lib/prisma", () => ({
  prisma: {
    tokenMetadataCache: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

import type { Address } from "viem";
import { fetchAndCacheTokenMetadata } from "./token-metadata";
import { prisma } from "@/lib/prisma";

const addr = "0xdddddddddddddddddddddddddddddddddddddddd" as Address;

describe("fetchAndCacheTokenMetadata", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
    (prisma.tokenMetadataCache.upsert as jest.Mock).mockClear();
  });

  it("throws for unsupported chainId", async () => {
    await expect(
      fetchAndCacheTokenMetadata({
        chainId: 999999,
        tokenAddress: addr,
        standard: "ERC20",
      }),
    ).rejects.toThrow("Unsupported chainId");
  });

  it("ERC20: reads name/symbol and upserts cache", async () => {
    mockReadContract.mockResolvedValueOnce("My Token").mockResolvedValueOnce("MTK");
    const out = await fetchAndCacheTokenMetadata({
      chainId: 1030,
      tokenAddress: addr,
      standard: "ERC20",
    });
    expect(out).toEqual({ name: "My Token", symbol: "MTK", uri: null });
    expect(prisma.tokenMetadataCache.upsert).toHaveBeenCalled();
  });

  it("ERC1155: reads uri path", async () => {
    mockReadContract.mockResolvedValueOnce("ipfs://meta");
    const out = await fetchAndCacheTokenMetadata({
      chainId: 1030,
      tokenAddress: addr,
      standard: "ERC1155",
    });
    expect(out.uri).toBe("ipfs://meta");
  });
});
