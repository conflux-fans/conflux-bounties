import type { Address } from "viem";
import { prisma } from "@/lib/prisma";
import { rulesJsonSchema } from "@/lib/gating/types";
import { evaluateRulesJson } from "@/lib/gating/evaluate";
import { pathMatches } from "@/lib/gating/match";

/** Paths that must match at least one gating rule (no implicit public access). */
const RULE_REQUIRED_PREFIXES = ["/members", "/resources", "/api/protected"];

function pathRequiresRule(pathname: string): boolean {
  return RULE_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type GateResult = {
  allowed: boolean;
  reason: string;
  ruleId?: string;
};

export async function checkPathAccess(
  pathname: string,
  wallet: Address | null,
  meta?: { ip?: string; userAgent?: string },
): Promise<GateResult> {
  if (!wallet) {
    return { allowed: false, reason: "not_authenticated" };
  }

  const w = wallet.toLowerCase();

  const denied = await prisma.denylistEntry.findUnique({ where: { address: w } });
  if (denied) {
    return { allowed: false, reason: "denylisted" };
  }

  const allowedEntry = await prisma.allowlistEntry.findUnique({
    where: { address: w },
  });
  if (allowedEntry) {
    return { allowed: true, reason: "allowlisted" };
  }

  const rules = await prisma.gatingRule.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const matched = rules.filter((r) => pathMatches(r.pathPattern, pathname));
  if (matched.length === 0) {
    if (pathRequiresRule(pathname)) {
      return { allowed: false, reason: "no_rule_configured" };
    }
    return { allowed: true, reason: "no_rule" };
  }

  for (const rule of matched) {
    const parsed = rulesJsonSchema.safeParse(rule.rulesJson);
    if (!parsed.success) continue;

    const combine =
      rule.combineLogic === "ANY" ? "ANY" : ("ALL" as const);
    const ok = await evaluateRulesJson(wallet, parsed.data, combine);
    if (ok) {
      await prisma.accessLog.create({
        data: {
          walletAddress: w,
          path: pathname,
          ruleId: rule.id,
          allowed: true,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });
      return { allowed: true, reason: "rule_passed", ruleId: rule.id };
    }
  }

  const primaryRule = matched[0];
  await prisma.accessLog.create({
    data: {
      walletAddress: w,
      path: pathname,
      ruleId: primaryRule?.id,
      allowed: false,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      meta: { failedRules: matched.map((r) => r.id) },
    },
  });

  return { allowed: false, reason: "rule_failed", ruleId: primaryRule?.id };
}
