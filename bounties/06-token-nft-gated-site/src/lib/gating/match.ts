/** Match request path to stored pattern (prefix). */
export function pathMatches(pattern: string, pathname: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  if (p.endsWith("*")) {
    const prefix = p.slice(0, -1);
    return pathname.startsWith(prefix);
  }
  return pathname === p || pathname.startsWith(`${p}/`);
}
