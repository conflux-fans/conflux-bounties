import { FastifyReply, FastifyRequest } from "fastify";
import { SiweMessage } from "siwe";

declare module "fastify" {
  interface FastifyRequest {
    walletAddress?: string;
  }
}

/**
 * SIWE (Sign-In with Ethereum) authentication middleware.
 * Expects headers: x-siwe-message (JSON) and x-siwe-signature.
 * In development, accepts x-wallet-address header as a bypass.
 */
export async function siweAuth(request: FastifyRequest, reply: FastifyReply) {
  // Dev bypass: accept x-wallet-address header directly
  const devWallet = request.headers["x-wallet-address"] as string | undefined;
  if (process.env.NODE_ENV !== "production" && devWallet) {
    request.walletAddress = devWallet.toLowerCase();
    return;
  }

  const messageRaw = request.headers["x-siwe-message"] as string | undefined;
  const signature = request.headers["x-siwe-signature"] as string | undefined;

  if (!messageRaw || !signature) {
    return reply.status(401).send({ error: "Missing SIWE message or signature" });
  }

  try {
    const message = new SiweMessage(JSON.parse(messageRaw));
    const result = await message.verify({ signature });

    if (!result.success) {
      return reply.status(401).send({ error: "Invalid SIWE signature" });
    }

    if (message.expirationTime && new Date(message.expirationTime) < new Date()) {
      return reply.status(401).send({ error: "SIWE message expired" });
    }

    request.walletAddress = message.address.toLowerCase();
  } catch {
    return reply.status(401).send({ error: "Invalid SIWE authentication" });
  }
}

/**
 * Moderator-only guard. Must be used after siweAuth.
 * Checks if the authenticated wallet is in the MODERATOR_ADDRESSES list.
 */
export function moderatorGuard(moderatorAddresses: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.walletAddress) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    if (!moderatorAddresses.includes(request.walletAddress)) {
      return reply.status(403).send({ error: "Not a moderator" });
    }
  };
}
