import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/auth/get-session", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/gating/access", () => ({
  checkPathAccess: jest.fn(),
}));

import { getSession } from "@/lib/auth/get-session";
import { checkPathAccess } from "@/lib/gating/access";

const addr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("GET /api/protected/ping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("401 without session", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://127.0.0.1/api/protected/ping");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("403 when gate denies", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      address: addr,
      sessionId: "s1",
    });
    (checkPathAccess as jest.Mock).mockResolvedValue({
      allowed: false,
      reason: "no_rule",
    });
    const req = new NextRequest("http://127.0.0.1/api/protected/ping");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("200 when allowed", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      address: addr,
      sessionId: "s1",
    });
    (checkPathAccess as jest.Mock).mockResolvedValue({
      allowed: true,
      reason: "ok",
    });
    const req = new NextRequest("http://127.0.0.1/api/protected/ping");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; address?: string };
    expect(body.ok).toBe(true);
    expect(body.address).toBe(addr);
  });
});
