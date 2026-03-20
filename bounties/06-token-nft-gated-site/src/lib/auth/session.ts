import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Address } from "viem";

export { SESSION_COOKIE_NAME } from "@/lib/auth/session-constants";

export type SessionJwtPayload = JWTPayload & {
  sid: string;
  addr: string;
};

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be set (min 32 chars)");
  }
  return new TextEncoder().encode(s);
}

export async function signSessionToken(params: {
  sessionId: string;
  address: Address;
  maxDays: number;
}): Promise<string> {
  const maxDays = params.maxDays;
  return new SignJWT({ sid: params.sessionId, addr: params.address.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.address.toLowerCase())
    .setIssuedAt()
    .setExpirationTime(`${maxDays}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const sid = payload.sid;
    const addr = payload.addr;
    if (typeof sid !== "string" || typeof addr !== "string") return null;
    return payload as SessionJwtPayload;
  } catch {
    return null;
  }
}
