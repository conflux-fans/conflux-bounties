import { checkPathAccess } from "./access";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    denylistEntry: { findUnique: jest.fn() },
    allowlistEntry: { findUnique: jest.fn() },
    gatingRule: { findMany: jest.fn() },
    accessLog: { create: jest.fn() },
  },
}));

jest.mock("@/lib/gating/evaluate", () => ({
  evaluateRulesJson: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { evaluateRulesJson } from "@/lib/gating/evaluate";

const wallet = "0x1111111111111111111111111111111111111111" as const;

describe("checkPathAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.denylistEntry.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.allowlistEntry.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("denies without wallet", async () => {
    const r = await checkPathAccess("/members", null);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("not_authenticated");
  });

  it("denies denylisted wallet", async () => {
    (prisma.denylistEntry.findUnique as jest.Mock).mockResolvedValue({
      address: wallet.toLowerCase(),
    });
    const r = await checkPathAccess("/members", wallet);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("denylisted");
  });

  it("allows allowlisted wallet without rule eval", async () => {
    (prisma.allowlistEntry.findUnique as jest.Mock).mockResolvedValue({
      address: wallet.toLowerCase(),
    });
    const r = await checkPathAccess("/members", wallet);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("allowlisted");
  });

  it("denies members when no rule matches path", async () => {
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: "r1",
        pathPattern: "/other",
        combineLogic: "ALL",
        rulesJson: { conditions: [] },
        enabled: true,
      },
    ]);
    const r = await checkPathAccess("/members", wallet);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no_rule_configured");
  });

  it("allows when rule passes", async () => {
    (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: "r1",
        pathPattern: "/members",
        combineLogic: "ALL",
        rulesJson: {
          conditions: [
            {
              type: "ERC20",
              chainId: 1030,
              address: "0x0000000000000000000000000000000000000001",
              minBalance: "0",
            },
          ],
        },
        enabled: true,
      },
    ]);
    (evaluateRulesJson as jest.Mock).mockResolvedValue(true);
    const r = await checkPathAccess("/members", wallet);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("rule_passed");
  });
});
