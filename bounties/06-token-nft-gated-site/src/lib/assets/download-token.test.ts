import {
  signDownloadToken,
  verifyDownloadToken,
} from "@/lib/assets/download-token";

describe("download-token", () => {
  const prev = process.env.SESSION_SECRET;
  beforeAll(() => {
    process.env.SESSION_SECRET = "x".repeat(32);
  });
  afterAll(() => {
    process.env.SESSION_SECRET = prev;
  });

  it("round-trips and verifies wallet/slug/exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = signDownloadToken({
      slug: "sample-pdf",
      wallet: "0xAbC",
      exp,
    });
    const v = verifyDownloadToken(token);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.slug).toBe("sample-pdf");
      expect(v.payload.wallet).toBe("0xAbC");
      expect(v.payload.exp).toBe(exp);
    }
  });

  it("rejects tampered token", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signDownloadToken({
      slug: "a",
      wallet: "0x1111111111111111111111111111111111111111",
      exp,
    });
    const broken = token.slice(0, -4) + "xxxx";
    expect(verifyDownloadToken(broken).ok).toBe(false);
  });

  it("rejects expired token", () => {
    const token = signDownloadToken({
      slug: "a",
      wallet: "0x2222222222222222222222222222222222222222",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(verifyDownloadToken(token).ok).toBe(false);
  });
});
