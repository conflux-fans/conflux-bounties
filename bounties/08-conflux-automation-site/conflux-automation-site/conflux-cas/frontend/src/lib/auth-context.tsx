'use client';

/**
 * AuthContext – single source of truth for wallet + SIWE auth state.
 *
 * Design:
 *  - The context is provided once at layout level (inside WagmiProvider).
 *  - All components that need auth state consume useAuthContext() rather than
 *    calling useAuth() directly.  This guarantees every consumer sees the same
 *    token and loading flags with no risk of desync.
 *
 * Auto-sign flow:
 *  - When wagmi reports isConnected = true and no JWT exists, the context
 *    automatically kicks off the SIWE login() call without requiring the user
 *    to click a separate "Sign In" button.
 *  - If the user rejects the signature the error is surfaced and a manual
 *    retry button appears in the NavBar — the auto-trigger fires only ONCE
 *    per connection event to avoid a runaway prompt loop.
 *  - When the wallet disconnects or the address changes, the JWT is cleared.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SiweMessage } from 'siwe';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthCtx {
  /** Persisted JWT, null when not authenticated. */
  token: string | null;
  /** Checksummed wallet address, null when not connected. */
  address: string | null;
  /** True while the SIWE nonce-fetch → sign → verify round-trip is in progress. */
  isLoading: boolean;
  /** True when token is non-null and wallet is connected. */
  isAuthenticated: boolean;
  /** Last login error message (e.g. "User rejected request"). */
  error: string | null;
  /** Manually trigger SIWE login (e.g. retry after rejection). */
  login: () => Promise<void>;
  /** Clear JWT + disconnect wallet. */
  logout: () => void;
  /**
   * Clear the stored JWT and reset the auto-sign guard so a fresh SIWE is
   * triggered on the next render cycle.  Call this when any API request
   * returns 401 (expired or invalid token) to transparently re-authenticate
   * the same wallet without the user having to do anything manually.
   */
  refreshAuth: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const TOKEN_KEY = 'cas_jwt';

/**
 * Decode a JWT payload (no signature verification — just parse the base64
 * body) and return the expiry timestamp in milliseconds, or 0 if unreadable.
 */
function getJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Return `token` only if it hasn't expired yet; otherwise `null`. */
function validToken(token: string | null): string | null {
  if (!token) return null;
  const exp = getJwtExpiry(token);
  return exp === 0 || exp > Date.now() ? token : null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  // Initialise synchronously from localStorage so there is no flash of
  // "unauthenticated" on page reload when a token already exists.
  // Discard tokens that have already expired so the auto-sign effect fires
  // immediately on the next render rather than waiting for the first 401.
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_KEY);
    const valid = validToken(stored);
    if (stored && !valid) {
      // Proactively clear expired token so auto-sign picks it up.
      localStorage.removeItem(TOKEN_KEY);
    }
    return valid;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: tracks the address that triggered the latest auto-signed attempt so
  // we don't fire login() repeatedly if the effect re-runs (e.g. StrictMode).
  const autoSignedForRef = useRef<string | null>(null);
  // Track the previous non-null address so we can detect a wallet switch.
  const prevAddressRef = useRef<string | null>(null);

  // ── Clear token when the wallet SWITCHES to a different address ─────────────
  // We do NOT clear on address → undefined (transient disconnect / wagmi
  // re-initialise) because that would force re-sign on every page navigation
  // or tab switch where wagmi briefly loses the account before reconnecting.
  // Token expiry and explicit logouts are handled separately.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (address) prevAddressRef.current = address;
      return;
    }
    if (address) {
      // Address became known or changed.
      if (prevAddressRef.current && prevAddressRef.current !== address) {
        // Different wallet connected — previous session is invalid.
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
        autoSignedForRef.current = null;
      }
      prevAddressRef.current = address;
    }
    // When address becomes undefined we intentionally do nothing:
    // the token stays so the user doesn't have to re-sign after a brief
    // wagmi reconnect cycle or a Next.js client-side navigation.
  }, [address]);

  // ── Core login function ───────────────────────────────────────────────────
  const login = useCallback(async () => {
    if (!address) {
      setError('No wallet connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Nonce
      const nonceRes = await fetch(
        `${API_BASE}/auth/nonce?address=${encodeURIComponent(address)}`
      );
      if (!nonceRes.ok) throw new Error('Failed to fetch nonce');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      // 2. Build + sign SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Conflux Automation Service',
        uri: window.location.origin,
        version: '1',
        chainId:
          chainId ??
          (process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 1030 : 71),
        nonce,
      });
      const prepared = message.prepareMessage();
      const signature = await signMessageAsync({ message: prepared });

      // 3. Verify with backend → JWT
      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prepared, signature }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Verification failed');
      }
      const { token: jwt } = (await verifyRes.json()) as { token: string };

      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      // Don't surface "User rejected" as a scary error — just show retry.
      if (msg.includes('getChainId is not a function')) {
        setError(
          'Wallet connection issue. Please reconnect your wallet or try a different provider.'
        );
      } else {
        setError(
          msg.toLowerCase().includes('rejected')
            ? 'Signature rejected — try again.'
            : msg
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  // ── Auto-sign on connect (fires once per address) ─────────────────────────
  useEffect(() => {
    if (
      isConnected &&
      address &&
      !token &&
      !isLoading &&
      autoSignedForRef.current !== address // only once per address
    ) {
      autoSignedForRef.current = address;
      void login();
    }
  }, [isConnected, address, token, isLoading, login]);

  // ── Refresh auth (re-sign with the same wallet — used on 401 responses) ──
  const refreshAuth = useCallback(() => {
    setToken(null);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
    // Reset the guard so the auto-sign effect fires again for this address.
    autoSignedForRef.current = null;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
    autoSignedForRef.current = null;
    disconnect();
  }, [disconnect]);

  return (
    <AuthContext.Provider
      value={{
        token,
        address: address ?? null,
        isLoading,
        isAuthenticated: Boolean(token && address),
        error,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useAuthContext(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

/**
 * useAuthFetch — returns a `fetch`-compatible function that:
 *  1. Automatically injects `Authorization: Bearer <token>` on every request.
 *  2. Calls `refreshAuth()` when the server responds with HTTP 401, so the
 *     SIWE auto-sign flow re-fires and the user is silently re-authenticated
 *     with the same wallet (no manual action required on any device).
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const res = await authFetch('/api/jobs');
 */
export function useAuthFetch(): (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response> {
  const { token, refreshAuth } = useAuthContext();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const res = await fetch(input, { ...init, headers });

      if (res.status === 401) {
        refreshAuth();
      }

      return res;
    },
    [token, refreshAuth]
  );
}
