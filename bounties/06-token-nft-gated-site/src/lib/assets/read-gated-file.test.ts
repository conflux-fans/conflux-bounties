import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readGatedFile } from "./read-gated-file";

describe("readGatedFile", () => {
  it("reads file bytes from disk", async () => {
    const p = join(tmpdir(), `gated-read-${Date.now()}.bin`);
    await writeFile(p, "abc");
    try {
      const buf = await readGatedFile(p);
      expect(buf.toString()).toBe("abc");
    } finally {
      await unlink(p);
    }
  });
});
