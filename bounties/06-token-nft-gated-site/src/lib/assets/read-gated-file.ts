import { readFile } from "fs/promises";

export async function readGatedFile(absPath: string): Promise<Buffer> {
  return readFile(absPath);
}
