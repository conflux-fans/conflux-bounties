import { absoluteStoragePath, GATED_STORAGE_ROOT } from "./paths";

describe("absoluteStoragePath", () => {
  it("joins under gated root", () => {
    const p = absoluteStoragePath("bundled/sample.pdf");
    expect(p.startsWith(GATED_STORAGE_ROOT)).toBe(true);
    expect(p).toContain("bundled");
  });

  it("rejects path traversal", () => {
    expect(() => absoluteStoragePath("../..")).toThrow("Invalid storage key");
    expect(() => absoluteStoragePath("foo/../../../etc/passwd")).toThrow(
      "Invalid storage key",
    );
  });
});
