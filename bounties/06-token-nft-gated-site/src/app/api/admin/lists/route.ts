import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import type { NextRequest } from "next/server";

export async function GET() {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [allow, deny] = await Promise.all([
    prisma.allowlistEntry.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.denylistEntry.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ allowlist: allow, denylist: deny });
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    type?: "allow" | "deny";
    address?: string;
    note?: string;
  };

  if (!body.type || !body.address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const addr = body.address.toLowerCase();

  if (body.type === "allow") {
    const row = await prisma.allowlistEntry.upsert({
      where: { address: addr },
      create: { address: addr, note: body.note },
      update: { note: body.note ?? undefined },
    });
    return NextResponse.json(row);
  }

  const row = await prisma.denylistEntry.upsert({
    where: { address: addr },
    create: { address: addr, note: body.note },
    update: { note: body.note ?? undefined },
  });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const address = searchParams.get("address")?.toLowerCase();
  if (!type || !address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  if (type === "allow") {
    await prisma.allowlistEntry.deleteMany({ where: { address } });
  } else {
    await prisma.denylistEntry.deleteMany({ where: { address } });
  }
  return NextResponse.json({ ok: true });
}
