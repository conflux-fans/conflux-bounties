import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function POST() {
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    const payload = await verifySessionToken(raw);
    if (payload?.sid) {
      await prisma.session.updateMany({
        where: { id: payload.sid },
        data: { revokedAt: new Date() },
      });
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
