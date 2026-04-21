import { pathMatches } from "@/lib/gating/match";

describe("pathMatches", () => {
  it("matches exact path", () => {
    expect(pathMatches("/members", "/members")).toBe(true);
    expect(pathMatches("/members", "/members/extra")).toBe(true);
  });

  it("does not match unrelated", () => {
    expect(pathMatches("/members", "/admin")).toBe(false);
  });

  it("matches wildcard prefix", () => {
    expect(pathMatches("/resources/*", "/resources/alpha")).toBe(true);
    expect(pathMatches("/resources/*", "/resources")).toBe(false);
  });
});
