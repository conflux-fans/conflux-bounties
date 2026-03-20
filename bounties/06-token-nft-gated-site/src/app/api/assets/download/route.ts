import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { verifyDownloadToken } from "@/lib/assets/download-token";
import { absoluteStoragePath } from "@/lib/assets/paths";
import { clientIp } from "@/lib/request-meta";

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

  let buf: Buffer;
  try {
    buf = await readFile(absoluteStoragePath(asset.storageKey));
  } catch {
    return NextResponse.json({ error: "Asset missing" }, { status: 404 });
  }

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
      },
    },
  });

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
