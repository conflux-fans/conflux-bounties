import { signSessionToken, verifySessionToken } from "./session";

describe("session JWT", () => {
  const wallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

  it("signs and verifies roundtrip", async () => {
    const token = await signSessionToken({
      sessionId: "sess-1",
      address: wallet,
      maxDays: 7,
    });
    const payload = await verifySessionToken(token);
    expect(payload?.sid).toBe("sess-1");
    expect(payload?.addr).toBe(wallet.toLowerCase());
  });

  it("verifySessionToken returns null for garbage", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
