'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NETWORKS } from '@/lib/networks';

const SELLER_URL = process.env.NEXT_PUBLIC_SELLER_URL || 'http://localhost:3852';
const PAGE_SIZE = 20;

interface Payment {
  id: number;
  tx_hash: string;
  payer: string;
  token_symbol: string;
  amount_human: string;
  payment_method: string;
  endpoint: string;
  created_at: string;
}

export default function HistoryPage() {
  const [network, setNetwork] = useState('testnet');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const net = NETWORKS[network];
  const caip2 = `eip155:${net.chainId}`;

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    fetchPayments(caip2, 0);
  }, [network]);

  const fetchPayments = (networkCaip2: string, off: number) => {
    setLoading(true);
    fetch(`${SELLER_URL}/payments/history?network=${networkCaip2}&limit=${PAGE_SIZE}&offset=${off}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success !== false) {
          setPayments(data.payments || []);
          setTotal(data.total || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handlePrev = () => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    fetchPayments(caip2, newOffset);
  };

  const handleNext = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchPayments(caip2, newOffset);
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="hero">
        <div className="hero-badge">Payment History</div>
        <h1>Transaction Log</h1>
        <p>All x402 payments settled on Conflux eSpace</p>
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
              onClick={() => setNetwork(tab.id)}
            >
              {tab.label}
              <span className="chain-id">({tab.chainId})</span>
            </button>
          ))}
        </div>

        {/* Total count */}
        {!loading && total > 0 && (
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 12 }}>
            {total} payment{total !== 1 ? 's' : ''} on {net.name}
          </div>
        )}

        {/* Table */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['TX Hash', 'Payer', 'Token', 'Amount', 'Method', 'Endpoint', 'Time'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    color: 'var(--fg-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)' }}>
                    <span className="spinner" style={{ width: 20, height: 20 }} />
                  </td>
                </tr>
              )}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={7} style={{
                    padding: 40,
                    textAlign: 'center',
                    color: 'var(--fg-muted)',
                    fontSize: 14,
                  }}>
                    No payments on {net.name} yet. Try the{' '}
                    <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                      demo
                    </Link>.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(56,161,216,0.08)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {p.tx_hash ? (
                      <a
                        href={`${net.explorerUrl}/tx/${p.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        {p.tx_hash.slice(0, 12)}...
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                    {p.payer ? `${p.payer.slice(0, 8)}...${p.payer.slice(-4)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.token_symbol}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--warning)', fontWeight: 600, fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {p.amount_human}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className={`token-method method-${p.payment_method}`} style={{ position: 'static' }}>
                      {p.payment_method === 'eip3009' ? '3009' : p.payment_method === 'erc20' ? 'ERC20' : 'CFX'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                    {p.endpoint}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--fg-muted)', fontSize: 11 }}>
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            marginTop: 16,
            fontSize: 13,
          }}>
            <button
              onClick={handlePrev}
              disabled={offset === 0}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: offset === 0 ? 'transparent' : 'var(--surface)',
                color: offset === 0 ? 'var(--fg-muted)' : 'var(--fg)',
                cursor: offset === 0 ? 'default' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--mono)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={offset + PAGE_SIZE >= total}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: offset + PAGE_SIZE >= total ? 'transparent' : 'var(--surface)',
                color: offset + PAGE_SIZE >= total ? 'var(--fg-muted)' : 'var(--fg)',
                cursor: offset + PAGE_SIZE >= total ? 'default' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}

        <div className="x402-footer">
          <Link href="/">Demo</Link> &middot;{' '}
          <Link href="/admin">Admin</Link> &middot;{' '}
          <Link href="/pay">API Reference</Link>
        </div>
      </div>
    </>
  );
}
