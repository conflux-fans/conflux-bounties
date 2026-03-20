import {
  buildSiweMessage,
  parseSiweAddress,
  parseSiweChainId,
  parseSiweNonce,
} from "@/lib/auth/siwe-message";

describe("siwe-message", () => {
  it("builds and parses nonce and chainId", () => {
    const msg = buildSiweMessage({
      domain: "example.com",
      address: "0x1111111111111111111111111111111111111111",
      uri: "https://example.com",
      chainId: 1030,
      nonce: "abc12345",
      statement: "Test",
    });
    expect(parseSiweNonce(msg)).toBe("abc12345");
    expect(parseSiweChainId(msg)).toBe(1030);
    expect(parseSiweAddress(msg)).toBe(
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("returns null for bad message", () => {
    expect(parseSiweNonce("not a siwe")).toBeNull();
    expect(parseSiweAddress("foo")).toBeNull();
  });
});
