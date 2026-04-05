import { NextRequest } from "next/server";
import { POST } from "./route";

jest.mock("@/lib/auth/get-session", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/gating/access", () => ({
  checkPathAccess: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    gatedAsset: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/env", () => ({
  getEnv: () => ({ ASSET_URL_TTL_SEC: 300 }),
}));

import { getSession } from "@/lib/auth/get-session";
import { checkPathAccess } from "@/lib/gating/access";
import { prisma } from "@/lib/prisma";

const addr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("POST /api/assets/issue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
  });

  it("401 without session", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://127.0.0.1/api/assets/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "demo" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("400 for invalid slug", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      address: addr,
      sessionId: "s1",
    });
    const req = new NextRequest("http://127.0.0.1/api/assets/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("404 when asset missing", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      address: addr,
      sessionId: "s1",
    });
    (prisma.gatedAsset.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://127.0.0.1/api/assets/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "missing" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("200 returns signed download URL when gate allows", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      address: addr,
      sessionId: "s1",
    });
    (prisma.gatedAsset.findUnique as jest.Mock).mockResolvedValue({
      slug: "pack",
      sha256: "abc",
      storageKey: "gated/pack.zip",
    });
    (checkPathAccess as jest.Mock).mockResolvedValue({
      allowed: true,
      reason: "ok",
    });
    const req = new NextRequest("http://127.0.0.1/api/assets/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "pack" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url?: string; integrity?: { sha256?: string } };
    expect(body.url).toContain("/api/assets/download?t=");
    expect(body.integrity?.sha256).toBe("abc");
  });
});
