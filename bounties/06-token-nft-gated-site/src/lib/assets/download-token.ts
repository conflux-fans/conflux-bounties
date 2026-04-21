import { createHmac, timingSafeEqual } from "crypto";

export type DownloadTokenPayload = {
  slug: string;
  wallet: string;
  exp: number;
};

function signingSecret(): string {
  const s =
    process.env.ASSET_SIGNING_SECRET || process.env.SESSION_SECRET || "";
  if (s.length < 32) throw new Error("ASSET_SIGNING_SECRET or SESSION_SECRET required");
  return s;
}

export function signDownloadToken(p: DownloadTokenPayload): string {
  const body = `${p.slug}:${p.wallet.toLowerCase()}:${p.exp}`;
  const h = createHmac("sha256", signingSecret()).update(body).digest("hex");
  return Buffer.from(JSON.stringify({ ...p, h }), "utf8").toString("base64url");
}

export function verifyDownloadToken(
  token: string,
): { ok: true; payload: DownloadTokenPayload } | { ok: false } {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const { slug, wallet, exp, h } = JSON.parse(raw) as DownloadTokenPayload & {
      h: string;
    };
    if (
      typeof slug !== "string" ||
      typeof wallet !== "string" ||
      typeof exp !== "number" ||
      typeof h !== "string"
    ) {
      return { ok: false };
    }
    if (exp < Math.floor(Date.now() / 1000)) return { ok: false };
    const body = `${slug}:${wallet.toLowerCase()}:${exp}`;
    const expect = createHmac("sha256", signingSecret()).update(body).digest("hex");
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(expect, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
    return { ok: true, payload: { slug, wallet, exp } };
  } catch {
    return { ok: false };
  }
}
