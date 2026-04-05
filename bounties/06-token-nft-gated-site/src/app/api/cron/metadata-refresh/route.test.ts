import { GET } from "./route";
import { NextRequest } from "next/server";

jest.mock("@/lib/metadata/refresh-from-rules", () => ({
  refreshMetadataFromEnabledRules: jest.fn().mockResolvedValue({
    refreshed: [{ key: "k", ok: true }],
    cached: [],
  }),
}));

describe("GET /api/cron/metadata-refresh", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = prev;
  });

  it("503 when CRON_SECRET missing", async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://localhost/api/cron/metadata-refresh");
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it("401 when secret wrong", async () => {
    process.env.CRON_SECRET = "a".repeat(20);
    const req = new NextRequest("http://localhost/api/cron/metadata-refresh", {
      headers: { Authorization: "Bearer wrong" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("200 with bearer token", async () => {
    const secret = "b".repeat(20);
    process.env.CRON_SECRET = secret;
    const req = new NextRequest("http://localhost/api/cron/metadata-refresh", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean };
    expect(j.ok).toBe(true);
  });

  it("200 with query secret", async () => {
    const secret = "c".repeat(20);
    process.env.CRON_SECRET = secret;
    const req = new NextRequest(
      `http://localhost/api/cron/metadata-refresh?secret=${encodeURIComponent(secret)}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
