import { createMiddleware } from "hono/factory";
import { config } from "../lib/config.js";
import { verifySessionToken } from "../routes/adminAuth.js";

/**
 * Admin authentication middleware.
 *
 * Accepts two authentication methods:
 * 1. Wallet session token (from /admin/auth/verify) — for the admin dashboard.
 *    Sent as `Authorization: Bearer <token>` or `x-admin-token` header.
 * 2. Server-side API key (ADMIN_API_KEY env var) — for programmatic/CI access.
 *    Sent as `x-admin-key` header. NOT exposed to the frontend.
 */
export const adminAuth = createMiddleware(async (c, next) => {
  // 1. Try wallet session token
  const authHeader = c.req.header("authorization");
  const tokenHeader = c.req.header("x-admin-token");

  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const sessionToken = bearerToken || tokenHeader;

  if (sessionToken) {
    const wallet = verifySessionToken(sessionToken);
    if (wallet) {
      c.set("adminWallet" as never, wallet);
      return next();
    }
    // Token provided but invalid — don't fall through to API key
    return c.json({ error: "Invalid or expired session token — re-authenticate via wallet signature" }, 401);
  }

  // 2. Try server-side API key (for programmatic access, NOT exposed to frontend)
  const apiKey = c.req.header("x-admin-key");
  if (apiKey && config.adminApiKey && apiKey === config.adminApiKey) {
    return next();
  }

  // No valid credentials
  return c.json(
    { error: "Unauthorized — authenticate via wallet signature or provide a valid admin API key" },
    401
  );
});
