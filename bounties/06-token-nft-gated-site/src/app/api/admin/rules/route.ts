import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import { rulesJsonSchema } from "@/lib/gating/types";
import type { NextRequest } from "next/server";

export async function GET() {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await prisma.gatingRule.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    pathPattern?: string;
    combineLogic?: string;
    rulesJson?: unknown;
    sortOrder?: number;
    enabled?: boolean;
  };

  if (!body.name || !body.pathPattern || body.rulesJson == null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = rulesJsonSchema.safeParse(body.rulesJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rulesJson", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rule = await prisma.gatingRule.create({
    data: {
      name: body.name,
      pathPattern: body.pathPattern,
      combineLogic: body.combineLogic === "ANY" ? "ANY" : "ALL",
      rulesJson: parsed.data as object,
      sortOrder: body.sortOrder ?? 0,
      enabled: body.enabled !== false,
    },
  });

  return NextResponse.json(rule);
}
