import path from "path";

export const GATED_STORAGE_ROOT = path.join(process.cwd(), "storage", "gated");

export function absoluteStoragePath(storageKey: string): string {
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(GATED_STORAGE_ROOT, normalized);
  if (!full.startsWith(GATED_STORAGE_ROOT)) {
    throw new Error("Invalid storage key");
  }
  return full;
}
