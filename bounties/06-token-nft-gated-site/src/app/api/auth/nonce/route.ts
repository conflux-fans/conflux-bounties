import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { consumeLoginLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-meta";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  try {
    await consumeLoginLimit(`ip:${ip}`);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const value = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.nonce.create({
    data: { value, expiresAt },
  });

  return NextResponse.json({ nonce: value, expiresAt: expiresAt.toISOString() });
}
