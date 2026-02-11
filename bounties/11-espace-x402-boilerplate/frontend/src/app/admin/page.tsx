'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NETWORKS } from '@/lib/networks';

const SELLER_URL = process.env.NEXT_PUBLIC_SELLER_URL || 'http://localhost:3852';

interface Stats {
  total_payments: number;
  unique_payers: number;
  first_payment: string | null;
  last_payment: string | null;
  by_token: { token_symbol: string; count: number; payment_method: string }[];
  by_method: { payment_method: string; count: number }[];
  by_endpoint: { endpoint: string; count: number }[];
  recent: any[];
  daily: { day: string; count: number }[];
}

export default function AdminPage() {
  const [network, setNetwork] = useState('testnet');
  const [sellerOk, setSellerOk] = useState<boolean | null>(null);
  const [facilitatorOk, setFacilitatorOk] = useState<boolean | null>(null);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [healthRaw, setHealthRaw] = useState<any>(null);

  const net = NETWORKS[network];
  const caip2 = `eip155:${net.chainId}`;

  useEffect(() => {
    setSellerOk(null);
    setFacilitatorOk(null);
    setDbOk(null);
    setStats(null);

    // Check seller health
    fetch(`${SELLER_URL}/health`)
      .then((r) => r.json())
      .then((data) => {
        setSellerOk(true);
        setHealthRaw(data);
        // If health returns, facilitator is internal
        setFacilitatorOk(true);
      })
      .catch(() => setSellerOk(false));

    // Fetch stats
    fetch(`${SELLER_URL}/payments/stats?network=${caip2}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success !== false) {
          setStats(data);
          setDbOk(true);
        } else {
          setDbOk(false);
        }
      })
      .catch(() => setDbOk(false));
  }, [network, caip2]);

  return (
    <>
      <div className="hero">
        <div className="hero-badge">Admin Panel</div>
        <h1>System Dashboard</h1>
        <p>Service health, payment analytics, and network configuration</p>
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

        {/* Service Status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatusCard title="Seller API" ok={sellerOk} detail={SELLER_URL} />
          <StatusCard title="Facilitator" ok={facilitatorOk} detail="Internal :3851" />
          <StatusCard title="Database" ok={dbOk} detail="PostgreSQL 16" />
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Total Payments" value={stats.total_payments} />
            <MetricCard label="Unique Payers" value={stats.unique_payers} />
            <MetricCard label="Endpoints Used" value={stats.by_endpoint.length} />
            <MetricCard label="Tokens Used" value={stats.by_token.length} />
          </div>
        )}

        {/* Breakdown by Token */}
        {stats && stats.by_token.length > 0 && (
          <div style={cardStyle}>
            <h2 style={cardTitle}>Payments by Token</h2>
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Token', 'Method', 'Count'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.by_token.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(56,161,216,0.08)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.token_symbol}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`token-method method-${row.payment_method}`} style={{ position: 'static' }}>
                        {row.payment_method === 'eip3009' ? '3009' : row.payment_method === 'erc20' ? 'ERC20' : 'CFX'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: 'var(--warning)', fontWeight: 600 }}>
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Breakdown by Endpoint */}
        {stats && stats.by_endpoint.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h2 style={cardTitle}>Requests by Endpoint</h2>
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Endpoint', 'Requests'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.by_endpoint.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(56,161,216,0.08)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12 }}>{row.endpoint}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: 'var(--primary)', fontWeight: 600 }}>
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Payments */}
        {stats && stats.recent.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h2 style={cardTitle}>Recent Payments</h2>
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['TX Hash', 'Payer', 'Token', 'Amount', 'Endpoint', 'Time'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((p: any) => (
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
        )}

        {/* No Payments */}
        {stats && stats.total_payments === 0 && (
          <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: 'var(--fg-muted)' }}>
            No payments on {network} yet. Try the <Link href="/" style={{ color: 'var(--primary)' }}>demo</Link>.
          </div>
        )}

        {/* Network Info */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={cardTitle}>Network Configuration</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
            <InfoRow label="Network" value={net.name} />
            <InfoRow label="Chain ID" value={String(net.chainId)} />
            <InfoRow label="RPC" value={net.rpcUrl} mono />
            <InfoRow label="Explorer" value={net.explorerUrl} mono link={net.explorerUrl} />
          </div>
        </div>

        {/* Token Table */}
        <div style={{ ...cardStyle, marginTop: 16, padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 15, fontWeight: 700 }}>
            Supported Tokens ({net.tokens.length})
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Symbol', 'Name', 'Address', 'Decimals', 'Method'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {net.tokens.map((t) => (
                <tr key={t.symbol} style={{ borderBottom: '1px solid rgba(56,161,216,0.08)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{t.symbol}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--fg-muted)' }}>{t.name}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                    {t.address === '0x0000000000000000000000000000000000000000'
                      ? 'Native'
                      : `${t.address.slice(0, 10)}...${t.address.slice(-6)}`}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{t.decimals}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className={`token-method method-${t.paymentMethod}`} style={{ position: 'static' }}>
                      {t.paymentMethod === 'eip3009' ? '3009' : t.paymentMethod === 'erc20' ? 'ERC20' : 'CFX'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Raw Health */}
        {healthRaw && (
          <details style={{ marginTop: 20 }}>
            <summary style={{ color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer' }}>
              Raw health response
            </summary>
            <pre style={{
              marginTop: 8,
              padding: 16,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--fg-muted)',
              overflowX: 'auto',
            }}>
              {JSON.stringify(healthRaw, null, 2)}
            </pre>
          </details>
        )}

        <div className="x402-footer">
          <Link href="/">Demo</Link> &middot;{' '}
          <Link href="/history">History</Link> &middot;{' '}
          <Link href="/pay">API Reference</Link>
        </div>
      </div>
    </>
  );
}

// ── Helper components ──

function StatusCard({ title, ok, detail }: { title: string; ok: boolean | null; detail: string }) {
  const dotColor = ok === true ? 'var(--success)' : ok === false ? 'var(--danger)' : 'var(--warning)';
  const statusText = ok === true ? 'Online' : ok === false ? 'Offline' : 'Checking...';

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--mono)' }}>{detail}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: dotColor, fontWeight: 600 }}>{statusText}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--mono)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>{label}</div>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{
          fontSize: 12,
          fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
          color: 'var(--primary)',
          textDecoration: 'none',
        }}>
          {value}
        </a>
      ) : (
        <div style={{
          fontSize: 13,
          fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
          color: 'var(--fg)',
          wordBreak: 'break-all',
        }}>
          {value}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ──

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
};

const cardTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 12,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: 'var(--fg-muted)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};
