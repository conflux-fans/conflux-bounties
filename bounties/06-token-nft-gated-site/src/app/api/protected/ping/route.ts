import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { checkPathAccess } from "@/lib/gating/access";
import { clientIp } from "@/lib/request-meta";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathname = "/api/protected/ping";
  const gate = await checkPathAccess(pathname, session.address, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Forbidden", reason: gate.reason },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    address: session.address,
    gate,
  });
}
