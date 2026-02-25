'use client';

import { useAccount } from 'wagmi';

/**
 * Returns true if the currently connected wallet address is in the
 * NEXT_PUBLIC_ADMIN_ADDRESSES whitelist (comma-separated, case-insensitive).
 *
 * When the env var is absent or empty every address returns false, which keeps
 * the Safety panel hidden for all users until an admin list is configured.
 */
export function useIsAdmin(): boolean {
  const { address } = useAccount();
  if (!address) return false;

  const raw = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES ?? '';
  if (!raw.trim()) return false;

  const adminSet = new Set(
    raw
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter((a) => /^0x[0-9a-f]{40}$/.test(a))
  );

  return adminSet.has(address.toLowerCase());
}
