import { createMiddleware } from "hono/factory";
import { config } from "../lib/config.js";

/**
 * Admin authentication middleware.
 * Requires a valid ADMIN_API_KEY in the Authorization header (Bearer token)
 * or as an x-admin-key header.
 */
export const adminAuth = createMiddleware(async (c, next) => {
  const adminKey = config.adminApiKey;
  if (!adminKey) {
    return c.json(
      { error: "Admin API key not configured. Set ADMIN_API_KEY in environment." },
      503
    );
  }

  const authHeader = c.req.header("authorization");
  const headerKey = c.req.header("x-admin-key");

  let providedKey: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  } else if (headerKey) {
    providedKey = headerKey;
  }

  if (!providedKey || providedKey !== adminKey) {
    return c.json({ error: "Unauthorized — valid admin key required" }, 401);
  }

  return next();
});
