import { NextRequest } from "next/server";
import { POST } from "./route";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    nonce: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  consumeLoginLimit: jest.fn().mockResolvedValue(undefined),
}));

describe("POST /api/auth/nonce", () => {
  it("returns nonce and expiresAt", async () => {
    const req = new NextRequest("http://127.0.0.1/api/auth/nonce", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nonce?: string; expiresAt?: string };
    expect(body.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(body.expiresAt).toBeDefined();
  });
});
