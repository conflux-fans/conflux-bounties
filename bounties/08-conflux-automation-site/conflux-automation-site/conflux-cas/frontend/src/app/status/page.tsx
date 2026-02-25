'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface ContractStatus {
  ok: boolean;
  address: string;
}
interface SystemStatus {
  ts: string;
  network: string;
  checkedInMs: number;
  backend: { ok: boolean; uptimeSeconds: number; uptimeHuman: string };
  database: {
    ok: boolean;
    jobCount: number;
    executionCount: number;
    pendingJobs: number;
    activeJobs: number;
    failedJobs: number;
    lastExecutionAt: string | null;
  };
  rpc: { ok: boolean; blockNumber?: number; latencyMs?: number; url: string };
  contracts: {
    automationManager: ContractStatus;
    priceAdapter: ContractStatus;
    permitHandler: ContractStatus;
  };
  worker: {
    status: 'active' | 'idle' | 'unknown';
    lastSeenAt: string | null;
    lastExecutionAt: string | null;
  };
  paused: boolean;
}

// ── Indicator ──────────────────────────────────────────────────────────────
type Indicator = 'ok' | 'warn' | 'error';

function dot(s: Indicator) {
  const cls =
    s === 'ok'
      ? 'bg-emerald-400'
      : s === 'warn'
        ? 'bg-amber-400'
        : 'bg-red-500';
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${cls} mr-2 shrink-0 mt-0.5`}
    />
  );
}

function workerIndicator(status: SystemStatus['worker']['status']): Indicator {
  return status === 'active' ? 'ok' : status === 'idle' ? 'warn' : 'error';
}

// ── Card ───────────────────────────────────────────────────────────────────
function Card({
  title,
  indicator,
  children,
}: {
  title: string;
  indicator: Indicator;
  children: React.ReactNode;
}) {
  const border =
    indicator === 'ok'
      ? 'border-emerald-700/40'
      : indicator === 'warn'
        ? 'border-amber-600/40'
        : 'border-red-700/40';

  return (
    <div
      className={`rounded-xl border ${border} bg-slate-800/60 p-4 flex flex-col gap-2`}
    >
      <div className="flex items-start gap-1 font-semibold text-slate-100">
        {dot(indicator)}
        {title}
      </div>
      <div className="text-sm text-slate-400 space-y-1 pl-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-300 text-right break-all">{value}</span>
    </div>
  );
}

function Badge({
  text,
  variant,
}: {
  text: string;
  variant: 'ok' | 'warn' | 'error';
}) {
  const cls =
    variant === 'ok'
      ? 'bg-emerald-900/60 text-emerald-300'
      : variant === 'warn'
        ? 'bg-amber-900/60 text-amber-300'
        : 'bg-red-900/60 text-red-300';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${cls}`}>
      {text}
    </span>
  );
}

function relativeTime(isoStr: string | null): string {
  if (!isoStr) return 'never';
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Main ───────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 15_000;

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SystemStatus = await res.json();
      setStatus(data);
      setLastFetched(Date.now());
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // countdown ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">System Status</h1>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          {lastFetched && <span>Refreshing in {countdown}s</span>}
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 transition-colors text-xs"
          >
            {loading ? 'Checking…' : 'Refresh now'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-red-300 text-sm">
          Failed to fetch status: {error}
        </div>
      )}

      {/* Skeleton while loading first time */}
      {!status && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reorders
              key={i}
              className="rounded-xl border border-slate-700/40 bg-slate-800/40 h-28 animate-pulse"
            />
          ))}
        </div>
      )}

      {status && (
        <div className="space-y-4">
          {/* Top bar: network + paused */}
          <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
            <Badge text={status.network.toUpperCase()} variant="ok" />
            {status.paused && (
              <Badge text="AUTOMATIONS PAUSED" variant="error" />
            )}
            {status.ts && (
              <span className="text-slate-500">
                As of {new Date(status.ts).toLocaleTimeString()} — checked in{' '}
                {status.checkedInMs}ms
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backend */}
            <Card title="Backend API" indicator="ok">
              <Row
                label="Status"
                value={<Badge text="Online" variant="ok" />}
              />
              <Row label="Uptime" value={status.backend.uptimeHuman} />
            </Card>

            {/* Database */}
            <Card
              title="Database"
              indicator={status.database.ok ? 'ok' : 'error'}
            >
              <Row
                label="Status"
                value={
                  <Badge
                    text={status.database.ok ? 'Connected' : 'Error'}
                    variant={status.database.ok ? 'ok' : 'error'}
                  />
                }
              />
              <Row
                label="Jobs"
                value={`${status.database.jobCount} total · ${status.database.pendingJobs} pending · ${status.database.activeJobs} active · ${status.database.failedJobs} failed`}
              />
              <Row
                label="Executions"
                value={status.database.executionCount.toString()}
              />
              <Row
                label="Last exec"
                value={relativeTime(status.database.lastExecutionAt)}
              />
            </Card>

            {/* RPC */}
            <Card
              title="Conflux eSpace RPC"
              indicator={status.rpc.ok ? 'ok' : 'error'}
            >
              <Row
                label="Status"
                value={
                  <Badge
                    text={status.rpc.ok ? 'Reachable' : 'Unreachable'}
                    variant={status.rpc.ok ? 'ok' : 'error'}
                  />
                }
              />
              {status.rpc.blockNumber !== undefined && (
                <Row
                  label="Block"
                  value={`#${status.rpc.blockNumber.toLocaleString()}`}
                />
              )}
              {status.rpc.latencyMs !== undefined && (
                <Row label="Latency" value={`${status.rpc.latencyMs}ms`} />
              )}
              <Row
                label="URL"
                value={
                  <span className="font-mono text-xs">{status.rpc.url}</span>
                }
              />
            </Card>

            {/* Worker */}
            <Card
              title="Automation Worker"
              indicator={workerIndicator(status.worker.status)}
            >
              <Row
                label="Status"
                value={
                  <Badge
                    text={
                      status.worker.status.charAt(0).toUpperCase() +
                      status.worker.status.slice(1)
                    }
                    variant={workerIndicator(status.worker.status)}
                  />
                }
              />
              <Row
                label="Last heartbeat"
                value={relativeTime(status.worker.lastSeenAt)}
              />
              <Row
                label="Last execution"
                value={relativeTime(status.worker.lastExecutionAt)}
              />
            </Card>

            {/* Contracts */}
            <Card
              title="AutomationManager"
              indicator={status.contracts.automationManager.ok ? 'ok' : 'error'}
            >
              <Row
                label="Contract"
                value={
                  <Badge
                    text={
                      status.contracts.automationManager.ok
                        ? 'Deployed'
                        : 'Not found'
                    }
                    variant={
                      status.contracts.automationManager.ok ? 'ok' : 'error'
                    }
                  />
                }
              />
              <Row
                label="Address"
                value={
                  <a
                    href={`${status.network === 'mainnet' ? 'https://evm.confluxscan.io' : 'https://evmtestnet.confluxscan.io'}/address/${status.contracts.automationManager.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-conflux-400 hover:underline font-mono text-xs"
                  >
                    {shortenAddress(status.contracts.automationManager.address)}
                  </a>
                }
              />
            </Card>

            <Card
              title="SwappiPriceAdapter"
              indicator={status.contracts.priceAdapter.ok ? 'ok' : 'error'}
            >
              <Row
                label="Contract"
                value={
                  <Badge
                    text={
                      status.contracts.priceAdapter.ok
                        ? 'Deployed'
                        : 'Not found'
                    }
                    variant={status.contracts.priceAdapter.ok ? 'ok' : 'error'}
                  />
                }
              />
              <Row
                label="Address"
                value={
                  <a
                    href={`${status.network === 'mainnet' ? 'https://evm.confluxscan.io' : 'https://evmtestnet.confluxscan.io'}/address/${status.contracts.priceAdapter.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-conflux-400 hover:underline font-mono text-xs"
                  >
                    {shortenAddress(status.contracts.priceAdapter.address)}
                  </a>
                }
              />
            </Card>

            <Card
              title="PermitHandler"
              indicator={status.contracts.permitHandler.ok ? 'ok' : 'error'}
            >
              <Row
                label="Contract"
                value={
                  <Badge
                    text={
                      status.contracts.permitHandler.ok
                        ? 'Deployed'
                        : 'Not found'
                    }
                    variant={status.contracts.permitHandler.ok ? 'ok' : 'error'}
                  />
                }
              />
              <Row
                label="Address"
                value={
                  <a
                    href={`${status.network === 'mainnet' ? 'https://evm.confluxscan.io' : 'https://evmtestnet.confluxscan.io'}/address/${status.contracts.permitHandler.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-conflux-400 hover:underline font-mono text-xs"
                  >
                    {shortenAddress(status.contracts.permitHandler.address)}
                  </a>
                }
              />
            </Card>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
