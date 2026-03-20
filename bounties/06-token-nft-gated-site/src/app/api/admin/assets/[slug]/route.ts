import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import { absoluteStoragePath } from "@/lib/assets/paths";

type Ctx = { params: Promise<{ slug: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  const asset = await prisma.gatedAsset.findUnique({ where: { slug } });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await unlink(absoluteStoragePath(asset.storageKey));
  } catch {
    /* file may already be gone */
  }

  await prisma.gatedAsset.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
