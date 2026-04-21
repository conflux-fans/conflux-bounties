import type { Address } from "viem";
import { parseAdminWallets } from "@/lib/env";
import type { AppSession } from "@/lib/auth/get-session";

export function isAdminWallet(address: Address): boolean {
  const admins = parseAdminWallets(process.env.ADMIN_WALLETS);
  if (admins.size === 0) return false;
  return admins.has(address.toLowerCase());
}

export function requireAdmin(session: AppSession | null): AppSession {
  if (!session) throw new Error("unauthorized");
  if (!isAdminWallet(session.address)) throw new Error("forbidden");
  return session;
}
