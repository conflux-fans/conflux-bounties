import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const adminAddr = "0xcccccccccccccccccccccccccccccccccccccccc";

jest.mock("@/lib/auth/get-session", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    gatingRule: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { getSession } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

const validRules = {
  conditions: [
    {
      type: "ERC20" as const,
      chainId: 1030,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      minBalance: "1",
    },
  ],
};

describe("/api/admin/rules", () => {
  const prevAdmins = process.env.ADMIN_WALLETS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_WALLETS = adminAddr;
  });

  afterEach(() => {
    if (prevAdmins === undefined) delete process.env.ADMIN_WALLETS;
    else process.env.ADMIN_WALLETS = prevAdmins;
  });

  describe("GET", () => {
    it("403 when not admin", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        sessionId: "s1",
      });
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("200 lists rules for admin", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        address: adminAddr,
        sessionId: "s1",
      });
      (prisma.gatingRule.findMany as jest.Mock).mockResolvedValue([{ id: "1" }]);
      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as unknown[];
      expect(body).toEqual([{ id: "1" }]);
    });
  });

  describe("POST", () => {
    it("400 when body invalid", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        address: adminAddr,
        sessionId: "s1",
      });
      const req = new NextRequest("http://127.0.0.1/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("400 when rulesJson invalid", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        address: adminAddr,
        sessionId: "s1",
      });
      const req = new NextRequest("http://127.0.0.1/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Rule",
          pathPattern: "/x",
          rulesJson: { conditions: [] },
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("201 creates rule", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        address: adminAddr,
        sessionId: "s1",
      });
      const created = { id: "new", name: "R" };
      (prisma.gatingRule.create as jest.Mock).mockResolvedValue(created);
      const req = new NextRequest("http://127.0.0.1/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "R",
          pathPattern: "/resources/**",
          combineLogic: "ALL",
          rulesJson: validRules,
          sortOrder: 0,
          enabled: true,
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });
  });
});
