import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import { rulesJsonSchema } from "@/lib/gating/types";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;

  const data: Prisma.GatingRuleUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.pathPattern === "string") data.pathPattern = body.pathPattern;
  if (body.combineLogic === "ANY" || body.combineLogic === "ALL") {
    data.combineLogic = body.combineLogic;
  }
  if (body.rulesJson != null) {
    const parsed = rulesJsonSchema.safeParse(body.rulesJson);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid rulesJson" }, { status: 400 });
    }
    data.rulesJson = parsed.data;
  }
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  try {
    const rule = await prisma.gatingRule.update({
      where: { id },
      data,
    });
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await prisma.gatingRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
