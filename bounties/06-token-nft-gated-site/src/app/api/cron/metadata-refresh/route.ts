import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { refreshMetadataFromEnabledRules } from "@/lib/metadata/refresh-from-rules";

/**
 * Periodic metadata refresh (spec: not only manual admin).
 * Protect with CRON_SECRET — call from cron, GitHub Actions, Docker sidecar, or Vercel cron.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>` (for simple wget).
 */
function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const q = req.nextUrl.searchParams.get("secret");
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshMetadataFromEnabledRules();
    return NextResponse.json({
      ok: true,
      refreshed: result.refreshed.length,
      cachedRows: result.cached.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "refresh failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
