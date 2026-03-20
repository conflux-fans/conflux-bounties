import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Address } from "viem";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import { fetchAndCacheTokenMetadata } from "@/lib/metadata/token-metadata";
import { rulesJsonSchema } from "@/lib/gating/types";

export async function POST(req: NextRequest) {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    chainId?: number;
    tokenAddress?: string;
    standard?: "ERC20" | "ERC721" | "ERC1155";
  };

  if (
    body.chainId == null ||
    !body.tokenAddress?.match(/^0x[a-fA-F0-9]{40}$/) ||
    !body.standard
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const row = await fetchAndCacheTokenMetadata({
    chainId: body.chainId,
    tokenAddress: body.tokenAddress as Address,
    standard: body.standard,
  });

  return NextResponse.json(row);
}

/** Refresh metadata for all token addresses referenced in enabled rules (best-effort). */
export async function GET() {
  try {
    requireAdmin(await getSession());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await prisma.gatingRule.findMany({ where: { enabled: true } });
  const seen = new Set<string>();
  const results: { key: string; ok: boolean }[] = [];

  for (const rule of rules) {
    const parsed = rulesJsonSchema.safeParse(rule.rulesJson);
    if (!parsed.success) continue;
    for (const c of parsed.data.conditions) {
      const key = `${c.chainId}:${c.address.toLowerCase()}:${c.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const std =
          c.type === "ERC20"
            ? "ERC20"
            : c.type === "ERC721"
              ? "ERC721"
              : "ERC1155";
        await fetchAndCacheTokenMetadata({
          chainId: c.chainId,
          tokenAddress: c.address as Address,
          standard: std,
        });
        results.push({ key, ok: true });
      } catch {
        results.push({ key, ok: false });
      }
    }
  }

  const cached = await prisma.tokenMetadataCache.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ refreshed: results, cached });
}
