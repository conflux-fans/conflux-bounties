import type { Address } from "viem";
import { prisma } from "@/lib/prisma";
import { rulesJsonSchema } from "@/lib/gating/types";
import { fetchAndCacheTokenMetadata } from "@/lib/metadata/token-metadata";

export type RefreshRow = { key: string; ok: boolean };

/**
 * Walk enabled gating rules and refresh token metadata cache (best-effort).
 * Used by admin UI and the periodic cron job.
 */
export async function refreshMetadataFromEnabledRules(): Promise<{
  refreshed: RefreshRow[];
  cached: Awaited<ReturnType<typeof prisma.tokenMetadataCache.findMany>>;
}> {
  const rules = await prisma.gatingRule.findMany({ where: { enabled: true } });
  const seen = new Set<string>();
  const refreshed: RefreshRow[] = [];

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
        refreshed.push({ key, ok: true });
      } catch {
        refreshed.push({ key, ok: false });
      }
    }
  }

  const cached = await prisma.tokenMetadataCache.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return { refreshed, cached };
}
