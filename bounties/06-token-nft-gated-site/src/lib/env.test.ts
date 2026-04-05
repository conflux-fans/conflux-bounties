import { getEnv, parseAdminWallets } from "./env";

describe("getEnv", () => {
  it("parses required env", () => {
    const e = getEnv();
    expect(e.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(e.SIWC_DOMAIN).toBeDefined();
  });
});

describe("parseAdminWallets", () => {
  it("returns empty set for undefined", () => {
    expect(parseAdminWallets(undefined).size).toBe(0);
  });

  it("parses comma list", () => {
    const s = parseAdminWallets("0xabc0000000000000000000000000000000000001, 0xDEF0000000000000000000000000000000000002");
    expect(s.size).toBe(2);
    expect(s.has("0xabc0000000000000000000000000000000000001")).toBe(true);
  });
});
