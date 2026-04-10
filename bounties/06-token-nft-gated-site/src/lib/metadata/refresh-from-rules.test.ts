import { refreshMetadataFromEnabledRules } from "./refresh-from-rules";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    gatingRule: { findMany: jest.fn() },
    tokenMetadataCache: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/metadata/token-metadata", () => ({
  fetchAndCacheTokenMetadata: jest.fn().mockResolvedValue({
    name: "T",
    symbol: "T",
    uri: null,
  }),
}));

import { prisma } from "@/lib/prisma";
import { fetchAndCacheTokenMetadata } from "@/lib/metadata/token-metadata";

describe("refreshMetadataFromEnabledRules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.tokenMetadataCache.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("returns empty when no rules", async () => {
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([]);
    const r = await refreshMetadataFromEnabledRules();
    expect(r.refreshed).toEqual([]);
    expect(r.cached).toEqual([]);
  });

  it("refreshes ERC20 condition from enabled rule", async () => {
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: "1",
        rulesJson: {
          conditions: [
            {
              type: "ERC20",
              chainId: 1030,
              address: "0x0000000000000000000000000000000000000001",
              minBalance: "1",
            },
          ],
        },
      },
    ]);
    const r = await refreshMetadataFromEnabledRules();
    expect(r.refreshed.length).toBe(1);
    expect(r.refreshed[0].ok).toBe(true);
  });

  it("skips invalid rulesJson and deduplicates same token key", async () => {
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: "invalid",
        rulesJson: { conditions: [] }, // schema min(1) => invalid
      },
      {
        id: "dup-a",
        rulesJson: {
          conditions: [
            {
              type: "ERC721",
              chainId: 1030,
              address: "0x00000000000000000000000000000000000000aa",
              tokenId: "1",
            },
          ],
        },
      },
      {
        id: "dup-b",
        rulesJson: {
          conditions: [
            {
              type: "ERC721",
              chainId: 1030,
              address: "0x00000000000000000000000000000000000000aa",
              tokenId: "2",
            },
          ],
        },
      },
    ]);

    const r = await refreshMetadataFromEnabledRules();
    expect(r.refreshed).toEqual([
      { key: "1030:0x00000000000000000000000000000000000000aa:ERC721", ok: true },
    ]);
    expect(fetchAndCacheTokenMetadata).toHaveBeenCalledTimes(1);
  });

  it("marks key as failed when metadata fetch throws (ERC1155 branch)", async () => {
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: "1",
        rulesJson: {
          conditions: [
            {
              type: "ERC1155",
              chainId: 71,
              address: "0x00000000000000000000000000000000000000bb",
              tokenId: "7",
              minQuantity: "1",
            },
          ],
        },
      },
    ]);
    (fetchAndCacheTokenMetadata as jest.Mock).mockRejectedValueOnce(
      new Error("rpc failure"),
    );

    const r = await refreshMetadataFromEnabledRules();
    expect(r.refreshed).toEqual([
      { key: "71:0x00000000000000000000000000000000000000bb:ERC1155", ok: false },
    ]);
  });
});
