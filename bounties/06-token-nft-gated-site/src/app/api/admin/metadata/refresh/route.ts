import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Address } from "viem";
import { getSession } from "@/lib/auth/get-session";
import { requireAdmin } from "@/lib/admin";
import { fetchAndCacheTokenMetadata } from "@/lib/metadata/token-metadata";
import { refreshMetadataFromEnabledRules } from "@/lib/metadata/refresh-from-rules";

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

  const { refreshed, cached } = await refreshMetadataFromEnabledRules();
  return NextResponse.json({ refreshed, cached });
}
