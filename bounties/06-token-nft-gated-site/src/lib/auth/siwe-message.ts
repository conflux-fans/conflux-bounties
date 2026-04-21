/** EIP-4361 Sign-In with Ethereum / Conflux-compatible message (plain text). */

export type BuildSiweParams = {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  statement?: string;
  issuedAt?: string;
};

export function buildSiweMessage(p: BuildSiweParams): string {
  const statement = p.statement?.trim();
  const issuedAt = p.issuedAt ?? new Date().toISOString();
  const lines = [
    `${p.domain} wants you to sign in with your Ethereum account:`,
    p.address,
    "",
  ]; // EIP-4361 style; compatible with Conflux eSpace wallets
  if (statement) {
    lines.push(statement, "");
  }
  lines.push(
    `URI: ${p.uri}`,
    "Version: 1",
    `Chain ID: ${p.chainId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${issuedAt}`,
  );
  return lines.join("\n");
}

/** Minimal parser: extract nonce from a SIWE message (server-side sanity check). */
export function parseSiweNonce(message: string): string | null {
  const m = message.match(/^Nonce: (.+)$/m);
  return m?.[1]?.trim() ?? null;
}

export function parseSiweChainId(message: string): number | null {
  const m = message.match(/^Chain ID: (\d+)$/m);
  if (!m?.[1]) return null;
  return Number.parseInt(m[1], 10);
}

export function parseSiweAddress(message: string): string | null {
  const lines = message.split("\n");
  // Line after header is address
  const header = lines[0];
  if (!header?.includes("wants you to sign in")) return null;
  const addr = lines[1]?.trim();
  if (!addr?.startsWith("0x") || addr.length < 42) return null;
  return addr;
}
