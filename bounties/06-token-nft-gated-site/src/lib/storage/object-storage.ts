import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertS3Configured, isS3StorageConfigured } from "./config";
import { getObjectStorageEnv } from "./env";

let s3Client: S3Client | null = null;

/** Test helper: clear cached client between tests. */
export function resetS3ClientForTests(): void {
  s3Client = null;
}

function getBucket(): string {
  return getObjectStorageEnv()!.bucket;
}

function getClient(): S3Client {
  if (s3Client) return s3Client;
  assertS3Configured();
  const cfg = getObjectStorageEnv()!;
  const region = cfg.region === "auto" ? "us-east-1" : cfg.region;

  s3Client = new S3Client({
    region,
    endpoint: cfg.endpoint || undefined,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: Boolean(cfg.endpoint && cfg.forcePathStyle),
  });
  return s3Client;
}

export async function putGatedObject(
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteGatedObject(storageKey: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );
}

/**
 * Short-lived HTTPS URL to GET the object (Cloudflare R2 or any S3-compatible API).
 * After app-level HMAC gate passes, redirect the browser here.
 */
export async function presignGatedGetUrl(
  storageKey: string,
  options: {
    expiresInSec: number;
    filename?: string;
  },
): Promise<string> {
  const client = getClient();
  const cmd = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ...(options.filename
      ? {
          ResponseContentDisposition: `attachment; filename="${encodeURIComponent(options.filename)}"`,
        }
      : {}),
  });
  return getSignedUrl(client, cmd, {
    expiresIn: Math.max(1, Math.min(options.expiresInSec, 3600)),
  });
}

export { isS3StorageConfigured };
