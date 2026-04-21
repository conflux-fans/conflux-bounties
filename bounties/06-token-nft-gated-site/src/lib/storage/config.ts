import { getObjectStorageEnv } from "./env";

/** local = disk under storage/gated; r2|s3 = S3-compatible API (Cloudflare R2 recommended). */

export type StorageMode = "local" | "s3";

export function getStorageMode(): StorageMode {
  const m = process.env.STORAGE_MODE?.toLowerCase();
  if (m === "s3" || m === "r2") return "s3";
  return "local";
}

/** True when remote object storage (R2 / S3-compatible) is fully configured. */
export function isS3StorageConfigured(): boolean {
  return getStorageMode() === "s3" && getObjectStorageEnv() !== null;
}

export function assertS3Configured(): void {
  if (!isS3StorageConfigured()) {
    throw new Error(
      "Set STORAGE_MODE=r2 (or s3) and R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT (see .env.example). S3_* vars are accepted as aliases.",
    );
  }
}
