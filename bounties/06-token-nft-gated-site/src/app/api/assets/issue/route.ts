import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { checkPathAccess } from "@/lib/gating/access";
import { signDownloadToken } from "@/lib/assets/download-token";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { clientIp } from "@/lib/request-meta";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { slug?: string };
  const slug = body.slug?.trim();
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const asset = await prisma.gatedAsset.findUnique({ where: { slug } });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logicalPath = `/resources/file/${slug}`;
  const gate = await checkPathAccess(logicalPath, session.address, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Forbidden", reason: gate.reason },
      { status: 403 },
    );
  }

  const env = getEnv();
  const exp = Math.floor(Date.now() / 1000) + env.ASSET_URL_TTL_SEC;
  const token = signDownloadToken({
    slug,
    wallet: session.address,
    exp,
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(req.url).origin;
  const url = `${base}/api/assets/download?t=${encodeURIComponent(token)}`;

  return NextResponse.json({
    url,
    expiresAt: new Date(exp * 1000).toISOString(),
    integrity: { sha256: asset.sha256 },
  });
}
