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
});
