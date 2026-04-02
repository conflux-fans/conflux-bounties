import { Hono } from "hono";
import { createHmac, randomBytes } from "node:crypto";
import { verifyMessage } from "viem";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export const adminAuthRoutes = new Hono();

// ─── Nonce store (in-memory, short-lived) ───
const pendingNonces = new Map<string, { nonce: string; expiresAt: number }>();

// Prune expired nonces every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingNonces) {
    if (now > entry.expiresAt) pendingNonces.delete(key);
  }
}, 60_000).unref();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes to sign
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour sessions

// Secret for HMAC signing — derived from the service wallet key (always available on the backend)
// Falls back to ADMIN_API_KEY or a random secret per process restart
const HMAC_SECRET =
  config.serviceWalletKey ??
  config.adminApiKey ??
  randomBytes(32).toString("hex");

/**
 * Create an HMAC-signed session token.
 * Format: <wallet>:<expiresAt>:<signature>
 */
export function createSessionToken(wallet: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${wallet.toLowerCase()}:${expiresAt}`;
  const sig = createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

/**
 * Verify and decode a session token. Returns the wallet address if valid, null otherwise.
 */
export function verifySessionToken(token: string): string | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;

  const [wallet, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  const payload = `${wallet}:${expiresAtStr}`;
  const expected = createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");

  // Constant-time comparison
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  return wallet;
}

/**
 * Check if a wallet address is the authorized seller/admin.
 */
function isAdminWallet(wallet: string): boolean {
  return wallet.toLowerCase() === config.serviceWalletAddress.toLowerCase();
}

// ─── Routes ───

/**
 * GET /admin/auth/challenge?address=0x...
 * Returns a nonce for the wallet to sign.
 */
adminAuthRoutes.get("/challenge", (c) => {
  const address = c.req.query("address")?.toLowerCase();
  if (!address || !/^0x[a-f0-9]{40}$/i.test(address)) {
    return c.json({ error: "Valid wallet address required" }, 400);
  }

  if (!isAdminWallet(address)) {
    return c.json({ error: "Not an admin wallet" }, 403);
  }

  const nonce = randomBytes(32).toString("hex");
  pendingNonces.set(address, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });

  return c.json({
    nonce,
    message: `x402 Admin Login\n\nSign this message to authenticate as the seller admin.\n\nNonce: ${nonce}`,
  });
});

/**
 * POST /admin/auth/verify
 * Body: { address, signature }
 * Returns a session token if the signature is valid.
 */
adminAuthRoutes.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { address, signature } = body as { address?: string; signature?: string };

  if (!address || !signature) {
    return c.json({ error: "address and signature required" }, 400);
  }

  const addr = address.toLowerCase();
  const pending = pendingNonces.get(addr);
  if (!pending) {
    return c.json({ error: "No pending challenge — request /admin/auth/challenge first" }, 400);
  }

  // Consume the nonce (one-time use)
  pendingNonces.delete(addr);

  if (Date.now() > pending.expiresAt) {
    return c.json({ error: "Challenge expired — request a new one" }, 400);
  }

  const message = `x402 Admin Login\n\nSign this message to authenticate as the seller admin.\n\nNonce: ${pending.nonce}`;

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  } catch (err) {
    logger.warn({ err, address }, "Wallet signature verification failed");
    return c.json({ error: "Invalid signature" }, 401);
  }

  if (!isAdminWallet(addr)) {
    return c.json({ error: "Not an admin wallet" }, 403);
  }

  const token = createSessionToken(addr);
  logger.info({ address: addr }, "Admin wallet authenticated");

  return c.json({ token, expiresIn: SESSION_TTL_MS });
});
