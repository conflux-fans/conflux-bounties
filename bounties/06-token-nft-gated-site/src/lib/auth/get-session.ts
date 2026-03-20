import { cookies } from "next/headers";
import type { Address } from "viem";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export type AppSession = {
  id: string;
  address: Address;
};

export async function getSession(): Promise<AppSession | null> {
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const payload = await verifySessionToken(raw);
  if (!payload?.sid || typeof payload.addr !== "string") return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.walletAddress.toLowerCase() !== payload.addr.toLowerCase()) {
    return null;
  }

  return {
    id: session.id,
    address: session.walletAddress as Address,
  };
}
