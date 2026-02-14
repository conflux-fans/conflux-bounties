import { randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically random hex string of the given byte length.
 * Used for API keys and share slugs.
 */
export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a random slug suitable for share links (8 chars, alphanumeric).
 */
export function generateSlug(): string {
  return randomBytes(6)
    .toString('base64url')
    .slice(0, 8)
    .toLowerCase();
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a bigint wei value to a decimal string with 18 decimals.
 */
export function weiToEther(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  const fractionStr = fraction.toString().padStart(18, '0').replace(/0+$/, '');
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}

/**
 * Format a Date or ISO string to YYYY-MM-DD.
 */
export function toDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/**
 * Partition a numeric range [start, end] into chunks of the given size.
 * Returns an array of [chunkStart, chunkEnd] tuples.
 */
export function chunkRange(start: number, end: number, size: number): [number, number][] {
  const chunks: [number, number][] = [];
  for (let i = start; i <= end; i += size) {
    chunks.push([i, Math.min(i + size - 1, end)]);
  }
  return chunks;
}

/**
 * Convert rows into a CSV string with headers derived from object keys.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    ),
  ];
  return lines.join('\n');
}
