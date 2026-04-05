import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readGatedFile } from "@/lib/assets/read-gated-file";
import { prisma } from "@/lib/prisma";
import { verifyDownloadToken } from "@/lib/assets/download-token";
import { absoluteStoragePath } from "@/lib/assets/paths";
import { clientIp } from "@/lib/request-meta";
import { getEnv } from "@/lib/env";
import {
  isS3StorageConfigured,
  presignGatedGetUrl,
} from "@/lib/storage/object-storage";

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  if (!t) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const v = verifyDownloadToken(t);
  if (!v.ok) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  const asset = await prisma.gatedAsset.findUnique({
    where: { slug: v.payload.slug },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = v.payload.exp - nowSec;
  if (remaining <= 0) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  const env = getEnv();
  const expiresInSec = Math.min(remaining, env.ASSET_URL_TTL_SEC);

  await prisma.accessLog.create({
    data: {
      walletAddress: v.payload.wallet.toLowerCase(),
      path: `/api/assets/download:${asset.slug}`,
      allowed: true,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
      meta: {
        kind: "signed_download",
        slug: asset.slug,
        sha256: asset.sha256,
        sizeBytes: asset.sizeBytes,
        mimeType: asset.mimeType,
        delivery: isS3StorageConfigured()
          ? "r2_presigned_redirect"
          : "local_stream",
      },
    },
  });

  if (isS3StorageConfigured()) {
    try {
      const url = await presignGatedGetUrl(asset.storageKey, {
        expiresInSec,
        filename: asset.originalName,
      });
      return NextResponse.redirect(url, 302);
    } catch {
      return NextResponse.json({ error: "Storage error" }, { status: 502 });
    }
  }

  let buf: Buffer;
  try {
    buf = await readGatedFile(absoluteStoragePath(asset.storageKey));
  } catch {
    return NextResponse.json({ error: "Asset missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(asset.originalName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Sha256": asset.sha256,
      ETag: `"${asset.sha256}"`,
    },
  });
}
