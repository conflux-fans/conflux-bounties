'use client';

import { useAccount, useSignMessage } from 'wagmi';
import { useState } from 'react';

export function SiwcButton() {
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<'idle' | 'signing' | 'verifying' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!address || !chain) return;
    setStatus('signing');
    setError(null);

    try {
      // 1. Get nonce
      const nonceRes = await fetch('/api/auth/nonce', { method: 'POST' });
      const { nonce } = await nonceRes.json();

      // 2. Build SIWC message
      const domain = window.location.host;
      const uri = window.location.origin;
      const issuedAt = new Date().toISOString();
      const message = [
        `${domain} wants you to sign in with your Conflux account:`,
        address,
        '',
        'Sign in to access token-gated content.',
        '',
        `URI: ${uri}`,
        `Version: 1`,
        `Chain ID: ${chain.id}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join('\n');

      // 3. Sign
      const signature = await signMessageAsync({ message });

      // 4. Verify
      setStatus('verifying');
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature, address }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.json();
        throw new Error(body.error ?? 'Verification failed');
      }

      setStatus('success');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setStatus('error');
    }
  }

  if (!address) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleSignIn}
        disabled={status === 'signing' || status === 'verifying'}
        className="rounded bg-conflux-primary px-6 py-3 text-white font-medium hover:opacity-90 disabled:opacity-50"
      >
        {status === 'signing' && 'Sign message in wallet…'}
        {status === 'verifying' && 'Verifying…'}
        {(status === 'idle' || status === 'error' || status === 'success') && 'Sign In With Conflux'}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
