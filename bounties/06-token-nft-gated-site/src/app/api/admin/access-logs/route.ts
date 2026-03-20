import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.accessLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { rule: { select: { name: true, pathPattern: true } } },
  });
  return NextResponse.json(logs);
}
