import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '30d';

/**
 * Comma-separated list of Ethereum addresses that are allowed to call admin
 * endpoints (pause/resume the worker, etc.).
 * Addresses are compared case-insensitively.
 * Example env: ADMIN_ADDRESSES=0xAbc...,0xDef...
 */
const ADMIN_SET: Set<string> = new Set(
  (process.env.ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a))
);

export function isAdminAddress(address: string): boolean {
  return ADMIN_SET.has(address.toLowerCase());
}

export interface AuthPayload {
  address: string;
  iat: number;
  exp: number;
}

export function signToken(address: string): string {
  return jwt.sign({ address }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  } as jwt.SignOptions);
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as Request & { user?: AuthPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * requireAdmin — must be used after requireAuth (or can be used standalone;
 * it verifies the JWT itself).  Rejects with 403 if the authenticated address
 * is not in ADMIN_ADDRESSES.
 *
 * If ADMIN_ADDRESSES is empty (not configured), the check is bypassed so the
 * app remains usable in development without env configuration.  A warning is
 * logged at startup so operators know the gap.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Re-use requireAuth logic inline (don't chain middleware; gives cleaner errors)
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = header.slice(7);
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as Request & { user?: AuthPayload }).user = payload;

  // If no admins are configured, allow any signed-in user and emit a warning
  // so operators know the endpoint is open.
  if (ADMIN_SET.size === 0) {
    console.warn(
      '[requireAdmin] ADMIN_ADDRESSES is not set — admin endpoints are open to any signed-in user. Set ADMIN_ADDRESSES in .env to restrict access.'
    );
    next();
    return;
  }

  if (!isAdminAddress(payload.address)) {
    res
      .status(403)
      .json({ error: 'Forbidden — address is not in the admin whitelist' });
    return;
  }

  next();
}
