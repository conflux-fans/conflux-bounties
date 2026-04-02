import { keccak256, toBytes, toHex, hexToBytes, encodeAbiParameters, parseAbiParameters } from "viem";
import { X402_HEADERS } from "./constants.js";
import type { X402PaymentChallenge } from "./types.js";

export function buildPaymentHeaders(challenge: X402PaymentChallenge): Record<string, string> {
  const headers: Record<string, string> = {
    [X402_HEADERS.AMOUNT]: challenge.amount,
    [X402_HEADERS.TOKEN]: challenge.token,
    [X402_HEADERS.NONCE]: challenge.nonce,
    [X402_HEADERS.EXPIRY]: String(challenge.expiry),
    [X402_HEADERS.ENDPOINT]: challenge.endpoint,
    [X402_HEADERS.INVOICE_ID]: challenge.invoiceId,
  };
  if (challenge.description) {
    headers[X402_HEADERS.DESCRIPTION] = challenge.description;
  }
  if (challenge.recipient) {
    headers[X402_HEADERS.RECIPIENT] = challenge.recipient;
  }
  if (challenge.verifierAddress) {
    headers[X402_HEADERS.VERIFIER] = challenge.verifierAddress;
  }
  return headers;
}

export function parsePaymentHeaders(headers: Record<string, string>): X402PaymentChallenge {
  return {
    amount: headers[X402_HEADERS.AMOUNT],
    token: headers[X402_HEADERS.TOKEN],
    nonce: headers[X402_HEADERS.NONCE],
    expiry: Number(headers[X402_HEADERS.EXPIRY]),
    endpoint: headers[X402_HEADERS.ENDPOINT],
    invoiceId: headers[X402_HEADERS.INVOICE_ID],
    description: headers[X402_HEADERS.DESCRIPTION],
    recipient: headers[X402_HEADERS.RECIPIENT],
    verifierAddress: headers[X402_HEADERS.VERIFIER],
  };
}

/**
 * Split a 65-byte EIP-712 hex signature into { v, r, s } components.
 * Reusable across SDK client, web frontend, and agent code.
 */
export function splitSignature(signature: string): { v: number; r: string; s: string } {
  const r = `0x${signature.slice(2, 66)}`;
  const s = `0x${signature.slice(66, 130)}`;
  const v = parseInt(signature.slice(130, 132), 16);
  return { v, r, s };
}

/**
 * Hash a UUID nonce string to bytes32 for ERC-3009 authorization.
 * All consumers (SDK client, web frontend, agent) MUST use this function
 * to ensure consistent nonce derivation — a mismatch breaks signatures.
 */
export function hashNonce(uuidNonce: string): `0x${string}` {
  return toHex(hexToBytes(keccak256(toBytes(uuidNonce))));
}

/**
 * Hash a UUID invoice ID to bytes32 for on-chain storage.
 * @deprecated Use deriveInvoiceId() instead — invoiceId is now derived
 * deterministically from (from, recipient, token, nonce) on-chain.
 */
export function hashInvoiceId(invoiceId: string): `0x${string}` {
  return keccak256(toBytes(invoiceId));
}

/**
 * Derive the on-chain invoiceId deterministically from authorization parameters.
 * Matches the Solidity: keccak256(abi.encode(from, recipient, token, nonce)).
 * All consumers MUST use this to look up payments on-chain.
 */
export function deriveInvoiceId(
  from: `0x${string}`,
  recipient: `0x${string}`,
  token: `0x${string}`,
  nonce: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("address, address, address, bytes32"),
      [from, recipient, token, nonce]
    )
  );
}
