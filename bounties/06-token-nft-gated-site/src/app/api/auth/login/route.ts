import { NextResponse } from "next/server";
import { verifyMessage, type Address } from "viem";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import {
  parseSiweAddress,
  parseSiweChainId,
  parseSiweNonce,
} from "@/lib/auth/siwe-message";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { consumeLoginLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-meta";
import { appChains } from "@/lib/chains";
import { notifyAbuseWebhook } from "@/lib/abuse-webhook";

function parseSiweDomain(message: string): string | null {
  const m = message.match(/^([^\s\n]+) wants you to sign in with your Ethereum account:/m);
  return m?.[1]?.trim() ?? null;
}

async function verifyCaptchaIfConfigured(token: string | undefined): Promise<boolean> {
  const secret = process.env.CAPTCHA_SECRET;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  try {
    await consumeLoginLimit(`login:${ip}`);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await req.json()) as {
    message?: string;
    signature?: `0x${string}`;
    captchaToken?: string;
  };

  if (!body.message || !body.signature) {
    return NextResponse.json({ error: "message and signature required" }, { status: 400 });
  }

  if (!(await verifyCaptchaIfConfigured(body.captchaToken))) {
    await prisma.authFailureLog.create({
      data: { ip, reason: "captcha_failed", meta: { path: "/api/auth/login" } },
    });
    notifyAbuseWebhook({ type: "auth_failure", reason: "captcha_failed", ip });
    return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
  }

  const env = getEnv();
  const domain = parseSiweDomain(body.message);
  if (!domain || domain !== env.SIWC_DOMAIN) {
    await prisma.authFailureLog.create({
      data: { ip, reason: "bad_domain", meta: { domain } },
    });
    notifyAbuseWebhook({ type: "auth_failure", reason: "bad_domain", ip });
    return NextResponse.json({ error: "Invalid SIWE domain" }, { status: 400 });
  }

  const nonce = parseSiweNonce(body.message);
  if (!nonce) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const chainId = parseSiweChainId(body.message);
  if (chainId == null || !appChains.some((c) => c.id === chainId)) {
    return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
  }

  const record = await prisma.nonce.findUnique({ where: { value: nonce } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    await prisma.authFailureLog.create({
      data: { ip, reason: "bad_nonce", meta: { nonce } },
    });
    notifyAbuseWebhook({ type: "auth_failure", reason: "bad_nonce", ip });
    return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
  }

  const addrFromMessage = parseSiweAddress(body.message);
  if (!addrFromMessage) {
    return NextResponse.json({ error: "Could not parse address" }, { status: 400 });
  }

  try {
    await consumeLoginLimit(`wallet:${addrFromMessage.toLowerCase()}`);
  } catch {
    await prisma.authFailureLog.create({
      data: {
        ip,
        walletAddress: addrFromMessage.toLowerCase(),
        reason: "rate_limited",
        meta: { scope: "wallet_login" },
      },
    });
    notifyAbuseWebhook({
      type: "auth_failure",
      reason: "rate_limited_wallet",
      ip,
      wallet: addrFromMessage.toLowerCase(),
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const valid = await verifyMessage({
    address: addrFromMessage as Address,
    message: body.message,
    signature: body.signature,
  });

  if (!valid) {
    await prisma.authFailureLog.create({
      data: {
        ip,
        walletAddress: addrFromMessage.toLowerCase(),
        reason: "bad_signature",
        meta: { chainId },
      },
    });
    notifyAbuseWebhook({
      type: "auth_failure",
      reason: "bad_signature",
      ip,
      wallet: addrFromMessage.toLowerCase(),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  await prisma.nonce.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const maxDays = env.SESSION_MAX_DAYS;
  const expiresAt = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      walletAddress: addrFromMessage.toLowerCase(),
      expiresAt,
    },
  });

  const token = await signSessionToken({
    sessionId: session.id,
    address: addrFromMessage as Address,
    maxDays,
  });

  const res = NextResponse.json({
    ok: true,
    address: addrFromMessage.toLowerCase(),
  });

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: maxDays * 24 * 60 * 60,
  });

  return res;
}
