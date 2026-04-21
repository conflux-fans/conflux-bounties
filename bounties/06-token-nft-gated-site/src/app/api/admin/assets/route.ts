import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import { GATED_STORAGE_ROOT } from "@/lib/assets/paths";
import { isS3StorageConfigured, putGatedObject } from "@/lib/storage/object-storage";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "asset"
  );
}

export async function GET() {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assets = await prisma.gatedAsset.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const baseSlug = slugify(form.get("slug")?.toString() || file.name);
  let slug = baseSlug;
  let n = 0;
  while (await prisma.gatedAsset.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const fileBase = `${slug}-${sha256.slice(0, 8)}`;
  const storageKey = `uploads/${fileBase}`;
  const mimeType = file.type || "application/octet-stream";

  if (isS3StorageConfigured()) {
    await putGatedObject(storageKey, buf, mimeType);
  } else {
    const uploadsDir = path.join(GATED_STORAGE_ROOT, "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const abs = path.join(uploadsDir, fileBase);
    await writeFile(abs, buf);
  }

  const asset = await prisma.gatedAsset.create({
    data: {
      slug,
      originalName: file.name,
      mimeType,
      sha256,
      sizeBytes: buf.length,
      storageKey,
    },
  });

  return NextResponse.json(asset);
}
