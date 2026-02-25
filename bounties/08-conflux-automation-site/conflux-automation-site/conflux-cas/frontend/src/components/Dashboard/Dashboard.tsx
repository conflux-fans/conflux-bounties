'use client';

import type { DCAJob, Job, LimitOrderJob } from '@conflux-cas/shared';
import { ClipboardList, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { useTokenPrice } from '@/hooks/useTokenPrice';
import { useAuthContext } from '@/lib/auth-context';
import {
  AUTOMATION_MANAGER_ABI,
  AUTOMATION_MANAGER_ADDRESS,
} from '@/lib/contracts';
import { usePoolsContext } from '@/lib/pools-context';

const CACHE_KEY = 'cas_pool_meta_v2';
const POLL_MS = 30_000;

// ─── Token meta ──────────────────────────────────────────────────────────────

interface TokenMeta {
  symbol: string;
  decimals: number;
  logoURI?: string;
  name?: string;
}

function loadTokenCache(): Map<string, TokenMeta> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const c = JSON.parse(raw) as {
      tokens: Array<{
        address: string;
        symbol: string;
        decimals: number;
        logoURI?: string;
        name?: string;
      }>;
    };
    return new Map(
      c.tokens.map((t) => [
        t.address.toLowerCase(),
        {
          symbol: t.symbol,
          decimals: t.decimals,
          logoURI: t.logoURI,
          name: t.name,
        },
      ])
    );
  } catch {
    return new Map();
  }
}

function symOf(addr: string, cache: Map<string, TokenMeta>): string {
  return cache.get(addr.toLowerCase())?.symbol ?? `${addr.slice(0, 6)}…`;
}

function decimalsOf(addr: string, cache: Map<string, TokenMeta>): number {
  return cache.get(addr.toLowerCase())?.decimals ?? 18;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtAmt(wei: string, decimals: number): string {
  const n = Number(formatUnits(BigInt(wei), decimals));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toPrecision(4);
}

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtNext(ms: number): string {
  const diff = Math.floor((ms - Date.now()) / 1000);
  if (diff <= 0) return 'now';
  if (diff < 60) return `in ${diff}s`;
  if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
  return `in ${Math.floor(diff / 3600)}h`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  pending: { dot: 'bg-yellow-400', text: 'text-yellow-400' },
  active: { dot: 'bg-blue-400', text: 'text-blue-400' },
  executed: { dot: 'bg-green-400', text: 'text-green-400' },
  cancelled: { dot: 'bg-slate-500', text: 'text-slate-400' },
  failed: { dot: 'bg-red-500', text: 'text-red-400' },
  paused: { dot: 'bg-purple-400', text: 'text-purple-400' },
};

const TERMINAL = new Set(['executed', 'cancelled', 'failed']);

function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const s = STATUS_STYLES[norm] || {
    dot: 'bg-slate-400',
    text: 'text-slate-300',
  };

  return (
    <div className="flex items-center gap-2 font-medium w-24">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${s.dot} shadow-[0_0_8px_currentColor]`}
        style={{ color: 'var(--tw-shadow-color)' }}
      />
      <span className={`text-sm tracking-wide capitalize ${s.text}`}>
        {status}
      </span>
    </div>
  );
}

// ─── Mini token chip ──────────────────────────────────────────────────────────

function TokenChip({
  meta,
  size = 'sm',
}: {
  meta?: TokenMeta;
  size?: 'xs' | 'sm';
}) {
  const dim = size === 'xs' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className="inline-flex items-center gap-1.5">
      {meta?.logoURI ? (
        <img
          src={meta.logoURI}
          alt={meta.symbol}
          className={`${dim} rounded-full bg-slate-800 ring-1 ring-slate-600/50 object-contain flex-shrink-0`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span
          className={`${dim} rounded-full bg-slate-700 ring-1 ring-slate-600/50 flex-shrink-0`}
        />
      )}
      <span
        className="font-semibold text-slate-200 truncate max-w-[80px]"
        title={meta?.symbol ?? '?'}
      >
        {meta?.symbol ?? '?'}
      </span>
    </span>
  );
}

// ─── Job row ──────────────────────────────────────────────────────────────────

function JobRow({
  job,
  tokenCache,
  onCancel,
}: {
  job: Job;
  tokenCache: Map<string, TokenMeta>;
  onCancel: (id: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const { token } = useAuthContext();
  const { refresh } = usePoolsContext();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const handleCancel = async () => {
    setCancelling(true);
    try {
      // Cancel on-chain first if the job has an on-chain ID.
      if (job.onChainJobId && publicClient) {
        try {
          const hash = await writeContractAsync({
            address: AUTOMATION_MANAGER_ADDRESS,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'cancelJob',
            args: [job.onChainJobId as `0x${string}`],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        } catch (onChainErr: unknown) {
          const msg = (onChainErr as Error)?.message ?? '';
          // JobNotActive = already closed on-chain, proceed to clean up DB.
          if (
            !msg.includes('JobNotActive') &&
            !msg.includes('user rejected') &&
            !msg.includes('User rejected')
          ) {
            throw onChainErr;
          }
        }
      }
      await fetch(`/api/jobs/${job.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      refresh();
      onCancel(job.id);
    } catch {
      setCancelling(false);
    }
  };

  const isTerminal = TERMINAL.has(job.status);
  const _badgeCls = STATUS_STYLES[job.status] ?? STATUS_STYLES.failed;
  const isLimit = job.type === 'limit_order';

  const loTIn = isLimit ? (job as LimitOrderJob).params.tokenIn : undefined;
  const loTOut = isLimit ? (job as LimitOrderJob).params.tokenOut : undefined;
  const decIn = loTIn ? decimalsOf(loTIn, tokenCache) : 18;
  const decOut = loTOut ? decimalsOf(loTOut, tokenCache) : 18;

  const { swappiPrice, loading: priceLoading } = useTokenPrice(
    isLimit && !isTerminal ? loTIn : undefined,
    isLimit && !isTerminal ? loTOut : undefined,
    decIn,
    decOut
  );

  const metaIn = tokenCache.get(
    (job.type === 'limit_order'
      ? (job as LimitOrderJob).params.tokenIn
      : (job as DCAJob).params.tokenIn
    ).toLowerCase()
  );
  const metaOut = tokenCache.get(
    (job.type === 'limit_order'
      ? (job as LimitOrderJob).params.tokenOut
      : (job as DCAJob).params.tokenOut
    ).toLowerCase()
  );

  // Pair & amount
  let tokenIn: string, tokenOut: string, amtIn: string;
  let targetCell: React.ReactNode;

  if (job.type === 'limit_order') {
    const lo = job as LimitOrderJob;
    tokenIn = lo.params.tokenIn;
    tokenOut = lo.params.tokenOut;
    amtIn = fmtAmt(lo.params.amountIn, decimalsOf(tokenIn, tokenCache));
    const isGte = lo.params.direction === 'gte';
    const tgtRaw = Number(formatUnits(BigInt(lo.params.targetPrice), 18));
    const tgt = tgtRaw.toPrecision(5);

    let progressNode = null;
    if (swappiPrice && !isTerminal) {
      const current = parseFloat(swappiPrice);
      if (current > 0 && tgtRaw > 0) {
        const diffPct = Math.abs((tgtRaw - current) / tgtRaw) * 100;
        progressNode = (
          <span className="ml-2 text-[10px] text-slate-400 font-medium">
            ({diffPct.toFixed(2)}% away)
          </span>
        );
      }
    } else if (priceLoading && !isTerminal) {
      progressNode = (
        <span className="ml-2 text-[10px] text-slate-500 animate-pulse">
          (fetching…)
        </span>
      );
    }

    targetCell = (
      <div className="flex items-center">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
            isGte
              ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-300'
              : 'border-amber-800/70 bg-amber-950/40 text-amber-300'
          }`}
        >
          {isGte ? '↑' : '↓'} {tgt} <TokenChip meta={metaOut} size="xs" />
        </span>
        {progressNode}
      </div>
    );
  } else {
    const dca = job as DCAJob;
    tokenIn = dca.params.tokenIn;
    tokenOut = dca.params.tokenOut;
    amtIn = fmtAmt(dca.params.amountPerSwap, decimalsOf(tokenIn, tokenCache));
    const done = dca.params.swapsCompleted;
    const total = dca.params.totalSwaps;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const allDone = done >= total && total > 0;
    const next = isTerminal
      ? allDone
        ? 'Complete'
        : '—'
      : fmtNext(dca.params.nextExecution);
    const chipColor = allDone
      ? 'border-sky-800/70 bg-sky-950/40 text-sky-300'
      : isTerminal
        ? 'border-slate-700 bg-slate-900 text-slate-500'
        : 'border-blue-800/70 bg-blue-950/40 text-blue-300';
    targetCell = (
      <span
        className={`inline-flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 min-w-[8rem] ${chipColor}`}
      >
        {/* progress bar */}
        <span className="flex items-center gap-2">
          <span className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <span
              className={`h-full rounded-full transition-all ${allDone ? 'bg-sky-400' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="text-xs font-mono font-semibold shrink-0">
            {done}/{total}
          </span>
        </span>
        {/* next execution */}
        <span className="text-[10px] opacity-70 text-right">{next}</span>
      </span>
    );
  }

  const symIn = symOf(tokenIn, tokenCache);
  const _symOut = symOf(tokenOut, tokenCache);

  return (
    <tr className="border-[0.5px] border-slate-700/50 hover:border-slate-600 bg-slate-800/20 hover:bg-slate-800/60 transition-all rounded-xl relative group">
      {/* Status */}
      <td className="px-4 py-4 whitespace-nowrap first:rounded-l-xl">
        <StatusBadge status={job.status} />
        {!isTerminal && job.lastError && (
          <p
            className="mt-1 text-[10px] text-amber-400/80 truncate max-w-[12rem]"
            title={job.lastError}
          >
            ⚠ {job.lastError}
          </p>
        )}
      </td>
      {/* Type */}
      <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold text-slate-300 uppercase tracking-wider">
        {job.type === 'limit_order' ? 'Limit' : 'DCA'}
      </td>
      {/* Pair — icon chips */}
      <td className="px-4 py-4 whitespace-nowrap min-w-[140px]">
        <span className="flex items-center gap-2 text-sm bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-700/50 w-fit">
          <TokenChip meta={metaIn} />
          <span className="text-slate-500 font-medium">→</span>
          <TokenChip meta={metaOut} />
        </span>
      </td>
      {/* Amount — icon + number */}
      <td className="px-4 py-4 whitespace-nowrap min-w-[120px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-200 bg-slate-900/50 rounded-lg px-2.5 py-1 text-sm border border-slate-700/50 w-fit">
          <TokenChip meta={metaIn} size="xs" />
          <span className="truncate max-w-[80px]" title={amtIn}>
            {amtIn}
          </span>
          <span className="text-xs text-slate-500 truncate max-w-[50px]">
            {symIn}
          </span>
        </span>
      </td>
      {/* Target / Progress */}
      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-300">
        {targetCell}
      </td>
      {/* Retries */}
      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
        {job.retries}/{job.maxRetries}
      </td>
      {/* Created */}
      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
        {timeAgo(job.createdAt)}
      </td>
      {/* Actions */}
      <td className="px-4 py-4 whitespace-nowrap text-xs font-medium last:rounded-r-xl">
        <div className="flex items-center gap-3">
          <Link
            href={`/job/${job.id}`}
            className="text-conflux-400 hover:text-conflux-300 transition-colors"
          >
            Details
          </Link>
          {!isTerminal && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-60"
              title={cancelling ? 'Cancelling…' : 'Cancel strategy'}
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Cancelling…</span>
                </>
              ) : (
                'Cancel'
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard({ onCreateNew }: { onCreateNew?: () => void } = {}) {
  const { address } = useAccount();
  const { token } = useAuthContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenCache, setTokenCache] = useState<Map<string, TokenMeta>>(
    new Map()
  );
  const esRef = useRef<EventSource | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        setError('Sign in to view your strategies.');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = (await res.json()) as { jobs?: Job[] };
      setJobs(data.jobs ?? []);
      setError(null); // clear any previous auth/fetch error on success
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const connectSSERef = useRef<() => void>(() => undefined);

  connectSSERef.current = () => {
    if (!token) return;
    esRef.current?.close();
    const es = new EventSource(
      `/api/sse/jobs?token=${encodeURIComponent(token)}`
    );
    esRef.current = es;
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as {
          type: string;
          job: Job;
        };
        if (data.type === 'job_update') {
          setJobs((prev) =>
            prev.some((j) => j.id === data.job.id)
              ? prev.map((j) => (j.id === data.job.id ? data.job : j))
              : [data.job, ...prev]
          );
        }
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      es.close();
      setTimeout(() => connectSSERef.current(), 5_000);
    };
  };

  const connectSSE = useCallback(() => connectSSERef.current(), []);

  useEffect(() => {
    if (!address) return;
    // Reset loading + error whenever auth state changes so the UI doesn't
    // stay stuck on a 401 error after the user completes SIWE sign-in.
    setLoading(true);
    setError(null);
    setTokenCache(loadTokenCache());
    void fetchJobs();
    connectSSE();
    const poll = setInterval(() => void fetchJobs(), POLL_MS);
    return () => {
      clearInterval(poll);
      esRef.current?.close();
    };
  }, [address, fetchJobs, connectSSE]);

  if (loading)
    return <p className="text-slate-400 animate-pulse">Loading strategies…</p>;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">{error}</p>
        {error.includes('Sign in') && (
          <p className="text-slate-500 text-sm">
            Connect your wallet and sign in — your strategies will appear
            automatically.
          </p>
        )}
      </div>
    );

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/40 bg-slate-900/20 py-16 px-6 mt-6">
        <div className="flex bg-slate-800/50 w-12 h-12 rounded-full items-center justify-center text-slate-500 mb-4">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-300">
          No active strategies
        </h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-sm text-center">
          When you create automation orders like limit swaps or DCA strategies,
          they will appear here.
        </p>
      </div>
    );
  }

  const active = jobs.filter((j) => !TERMINAL.has(j.status));
  const terminal = jobs.filter((j) => TERMINAL.has(j.status));

  const renderTable = (rows: Job[], label: string) => (
    <div>
      {active.length > 0 && terminal.length > 0 && (
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
          {label}
        </h3>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900 text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Target / Progress</th>
              <th className="px-3 py-2 text-center">Retries</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                tokenCache={tokenCache}
                onCancel={(id) =>
                  setJobs((prev) => prev.filter((j) => j.id !== id))
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {active.length > 0 && renderTable(active, 'Active')}
      {terminal.length > 0 && renderTable(terminal, 'History')}
    </div>
  );
}
