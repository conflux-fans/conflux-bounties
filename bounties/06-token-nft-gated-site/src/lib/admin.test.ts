import { isAdminWallet, requireAdmin } from "./admin";

describe("admin helpers", () => {
  const prev = process.env.ADMIN_WALLETS;

  afterEach(() => {
    process.env.ADMIN_WALLETS = prev;
  });

  it("isAdminWallet false when unset", () => {
    delete process.env.ADMIN_WALLETS;
    expect(isAdminWallet("0x1111111111111111111111111111111111111111")).toBe(
      false,
    );
  });

  it("isAdminWallet true for listed wallet", () => {
    process.env.ADMIN_WALLETS =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(
      isAdminWallet("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ).toBe(true);
  });

  it("requireAdmin throws without session", () => {
    expect(() => requireAdmin(null)).toThrow("unauthorized");
  });
});
