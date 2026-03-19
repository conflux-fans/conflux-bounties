import { randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { SiweMessage } from 'siwe';
import { db } from '../db/client.js';
import { nonces } from '../db/schema.js';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class AuthService {
  /** Generate a new nonce for the given address and store it. */
  async generateNonce(address: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + NONCE_TTL_MS;
    await db.insert(nonces).values({
      nonce,
      address: address.toLowerCase(),
      expiresAt,
      used: false,
    });
    return nonce;
  }

  /**
   * Verify a SIWE message + signature.
   * Returns the verified address on success, throws on failure.
   */
  async verifySiweMessage(message: string, signature: string): Promise<string> {
    const siwe = new SiweMessage(message);

    // Verify signature via siwe library (handles EIP-1271 contracts too)
    const { data: fields } = await siwe.verify({ signature });

    // Validate nonce is known, not expired, not used
    const nonceRow = await db.query.nonces.findFirst({
      where: and(
        eq(nonces.nonce, fields.nonce),
        eq(nonces.address, fields.address.toLowerCase()),
        eq(nonces.used, false)
      ),
    });

    if (!nonceRow || Date.now() > nonceRow.expiresAt) {
      throw new Error('Invalid or expired nonce');
    }

    // Mark nonce as used (one-time)
    await db
      .update(nonces)
      .set({ used: true })
      .where(eq(nonces.nonce, fields.nonce));

    return fields.address;
  }

  /** Purge expired nonces (call periodically). */
  async pruneNonces(): Promise<void> {
    await db.delete(nonces).where(lt(nonces.expiresAt, Date.now()));
  }
}

export const authService = new AuthService();
