import { POST } from "./route";

const mockGet = jest.fn();

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: mockGet,
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

jest.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "gc_session",
  verifySessionToken: jest.fn(),
}));

import { verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockGet.mockReset();
    (verifySessionToken as jest.Mock).mockReset();
    (prisma.session.updateMany as jest.Mock).mockClear();
  });

  it("returns ok when no cookie", async () => {
    mockGet.mockReturnValue(undefined);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it("revokes session when cookie valid", async () => {
    mockGet.mockReturnValue({ value: "jwt-here" });
    (verifySessionToken as jest.Mock).mockResolvedValue({
      sid: "sess-1",
      addr: "0x",
    });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1" },
      }),
    );
  });
});
