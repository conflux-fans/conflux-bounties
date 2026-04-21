import path from "path";

export const GATED_STORAGE_ROOT = path.join(process.cwd(), "storage", "gated");

/**
 * Resolve a storage key relative to the gated root and reject path traversal.
 */
export function absoluteStoragePath(storageKey: string): string {
  if (!storageKey || storageKey.includes("\0")) {
    throw new Error("Invalid storage key");
  }
  const root = path.resolve(GATED_STORAGE_ROOT);
  const full = path.resolve(root, storageKey);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(prefix)) {
    throw new Error("Invalid storage key");
  }
  return full;
}
