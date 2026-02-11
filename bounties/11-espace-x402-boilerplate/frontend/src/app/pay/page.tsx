'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NETWORKS } from '@/lib/networks';

const SELLER_URL = process.env.NEXT_PUBLIC_SELLER_URL || 'http://localhost:3852';

export default function PayPage() {
  const [network, setNetwork] = useState('testnet');
  const [token, setToken] = useState('CFX');

  const net = NETWORKS[network];
  const tokens = net.tokens;
  const tokenObj = tokens.find((t) => t.symbol === token);

  const handleNetworkChange = (n: string) => {
    setNetwork(n);
    setToken('CFX');
  };

  const curlCmd = `curl -s "${SELLER_URL}/ai?q=What+is+Conflux&token=${token}"`;

  return (
    <>
      <div className="hero">
        <div className="hero-badge">API Reference</div>
        <h1>Pricing &amp; Tokens</h1>
        <p>Select a network and token to see x402 payment details and try the API</p>
      </div>

      <div className="container-main">
        {/* Network Tabs */}
        <div className="network-tabs">
          {[
            { id: 'testnet', label: 'Testnet', chainId: 71 },
            { id: 'mainnet', label: 'Mainnet', chainId: 1030 },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`network-tab ${network === tab.id ? 'active' : ''}`}
              onClick={() => handleNetworkChange(tab.id)}
            >
              {tab.label}
              <span className="chain-id">({tab.chainId})</span>
            </button>
          ))}
        </div>

        {/* Token Grid */}
        <div className="token-grid">
          {tokens.map((t) => (
            <button
              key={t.symbol}
              className={`token-card ${token === t.symbol ? 'active' : ''}`}
              onClick={() => setToken(t.symbol)}
            >
              <div className="token-symbol">{t.symbol}</div>
              <div className="token-name">{t.name}</div>
              <span className={`token-method method-${t.paymentMethod}`}>
                {t.paymentMethod === 'eip3009' ? '3009' : t.paymentMethod === 'erc20' ? 'ERC20' : 'CFX'}
              </span>
            </button>
          ))}
        </div>

        {/* Token Details */}
        {tokenObj && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Token</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{tokenObj.symbol}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Payment Method</div>
                <div style={{ fontWeight: 600 }}>
                  <span className={`token-method method-${tokenObj.paymentMethod}`} style={{ position: 'static', fontSize: 11 }}>
                    {tokenObj.paymentMethod}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Contract Address</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-muted)', wordBreak: 'break-all' }}>
                  {tokenObj.address === '0x0000000000000000000000000000000000000000'
                    ? 'Native coin (no contract)'
                    : tokenObj.address}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Decimals</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{tokenObj.decimals}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>Try it (terminal)</div>
              <pre style={{
                padding: 14,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
                fontFamily: 'var(--mono)',
                color: 'var(--success)',
                overflowX: 'auto',
                lineHeight: 1.6,
              }}>
                {curlCmd}
              </pre>
            </div>
          </div>
        )}

        <div className="x402-footer">
          <Link href="/">Demo</Link> &middot;{' '}
          <Link href="/history">History</Link> &middot;{' '}
          <Link href="/admin">Admin</Link> &middot;{' '}
          <a href="https://www.x402.org" target="_blank" rel="noopener noreferrer">x402 Protocol</a>
        </div>
      </div>
    </>
  );
}
