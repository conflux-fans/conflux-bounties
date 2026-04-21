/**
 * Cloudflare R2 is configured via R2_* (preferred). S3_* names are supported as
 * aliases — R2 exposes an S3-compatible API, so the AWS SDK works unchanged.
 */
export type ResolvedObjectStorageEnv = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region: string;
  forcePathStyle: boolean;
};

export function getObjectStorageEnv(): ResolvedObjectStorageEnv | null {
  const bucket =
    process.env.R2_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID?.trim() ||
    process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY?.trim() ||
    process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const endpoint =
    process.env.R2_ENDPOINT?.trim() || process.env.S3_ENDPOINT?.trim();
  const region = (
    process.env.R2_REGION?.trim() ||
    process.env.S3_REGION?.trim() ||
    "auto"
  ).trim();
  const forcePathStyle =
    process.env.R2_FORCE_PATH_STYLE === "true" ||
    process.env.R2_FORCE_PATH_STYLE === "1" ||
    process.env.S3_FORCE_PATH_STYLE === "true" ||
    process.env.S3_FORCE_PATH_STYLE === "1";

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint || undefined,
    region,
    forcePathStyle,
  };
}
