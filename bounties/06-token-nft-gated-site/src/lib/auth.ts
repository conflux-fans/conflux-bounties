import { verifyMessage } from 'viem';
import crypto from 'crypto';

export interface SiwcMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

/** Generate a cryptographically random nonce */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** Build the SIWC message string to be signed by the wallet */
export function buildSiwcMessage(params: SiwcMessage): string {
  return [
    `${params.domain} wants you to sign in with your Conflux account:`,
    params.address,
    '',
    params.statement,
    '',
    `URI: ${params.uri}`,
    `Version: ${params.version}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ].join('\n');
}

/** Parse a raw SIWC message string back into structured fields */
export function parseSiwcMessage(message: string): SiwcMessage | null {
  try {
    const lines = message.split('\n');
    const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your Conflux account:$/);
    if (!domainMatch) return null;

    const domain = domainMatch[1];
    const address = lines[1]?.trim();
    // lines[2] is blank
    const statement = lines[3]?.trim() ?? '';
    // lines[4] is blank

    let uri = '', version = '', chainId = 0, nonce = '', issuedAt = '';
    for (const line of lines.slice(5)) {
      if (line.startsWith('URI: ')) uri = line.slice(5);
      else if (line.startsWith('Version: ')) version = line.slice(9);
      else if (line.startsWith('Chain ID: ')) chainId = parseInt(line.slice(10), 10);
      else if (line.startsWith('Nonce: ')) nonce = line.slice(7);
      else if (line.startsWith('Issued At: ')) issuedAt = line.slice(11);
    }

    if (!address || !nonce) return null;
    return { domain, address, statement, uri, version, chainId, nonce, issuedAt };
  } catch {
    return null;
  }
}

/** Verify a SIWC signature using viem */
export async function verifySiwcSignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: string,
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: expectedAddress as `0x${string}`,
      message,
      signature,
    });
    return valid;
  } catch {
    return false;
  }
}
