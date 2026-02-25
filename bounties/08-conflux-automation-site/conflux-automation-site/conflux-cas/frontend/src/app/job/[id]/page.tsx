'use client';

import type { Job } from '@conflux-cas/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { useAuthContext } from '@/lib/auth-context';

const CACHE_KEY = 'cas_pool_meta_v2';

interface ExecutionRecord {
  id: number;
  jobId: string;
  txHash: string;
  timestamp: number;
  amountOut: string | null;
}

interface TokenMeta {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
}

function loadTokenCache(): Map<string, TokenMeta> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const c = JSON.parse(raw) as { tokens: TokenMeta[] };
    return new Map(c.tokens.map((t) => [t.address.toLowerCase(), t]));
  } catch {
    return new Map();
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  active: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  executed: 'bg-sky-900/60 text-sky-300 border-sky-700',
  cancelled: 'bg-slate-800 text-slate-500 border-slate-600',
  failed: 'bg-red-900/60 text-red-300 border-red-700',
  paused: 'bg-orange-900/60 text-orange-300 border-orange-700',
};

/** Trim amounts to a readable precision, strip trailing zeros. */
function fmtAmt(raw: string, decimals = 18): string {
  try {
    const n = Number(formatUnits(BigInt(raw), decimals));
    if (!Number.isFinite(n) || n === 0) return '0';
    let s: string;
    if (n >= 1_000_000)
      s = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    else if (n >= 1_000)
      s = n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    else if (n >= 1) s = n.toFixed(6).replace(/\.?0+$/, '');
    else s = n.toPrecision(6).replace(/\.?0+$/, '');
    return s;
  } catch {
    return raw;
  }
}

/** True when txHash is a real on-chain hash (not a sentinel like 'chain-sync'). */
function isRealTxHash(h: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(h);
}

/** Format a duration in seconds into a human-readable string, e.g. "5 min", "2 h 30 min", "1 day". */
function fmtInterval(seconds: number): string {
  if (seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s && !d && !h) parts.push(`${s} s`);
  return `Every ${parts.join(' ')}`;
}

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_NETWORK === 'mainnet'
    ? 'https://evm.confluxscan.io'
    : 'https://evmtestnet.confluxscan.io';

function explorerTx(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

function explorerAddress(address: string) {
  return `${EXPLORER_BASE}/address/${address}`;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [execList, setExecList] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthContext();
  const [tokenCache] = useState<Map<string, TokenMeta>>(() => loadTokenCache());

  useEffect(() => {
    if (!token) {
      setError('Sign in to view job details.');
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/jobs/${id}`, { headers }).then((r) => r.json()),
      fetch(`/api/jobs/${id}/executions`, { headers }).then((r) => r.json()),
    ])
      .then(([jobRes, execRes]) => {
        if (jobRes.error) throw new Error(jobRes.error);
        setJob(jobRes.job);
        setExecList(execRes.executions ?? []);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-slate-700 rounded" />
        <div className="h-40 bg-slate-800 rounded-xl" />
        <div className="h-32 bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error ?? 'Job not found.'}</p>
        <Link href="/dashboard" className="text-conflux-400 underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const isActive = job.status === 'active' || job.status === 'pending';
  const retriesExhausted = isActive && job.retries >= job.maxRetries;
  const statusCls =
    STATUS_COLORS[job.status] ?? 'bg-slate-700 text-slate-400 border-slate-600';
  const tokenInMeta = tokenCache.get(job.params.tokenIn.toLowerCase());
  const tokenOutMeta = tokenCache.get(job.params.tokenOut.toLowerCase());

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Retry-exhaustion warning banner */}
      {retriesExhausted && (
        <div className="rounded-xl bg-orange-950 border border-orange-800 p-4 text-sm text-orange-200">
          <p className="font-semibold">
            ⚠ Strategy blocked — max retries reached ({job.retries}/
            {job.maxRetries})
          </p>
          <p className="mt-1 text-orange-300 text-xs">
            The worker tried to execute this strategy {job.retries} times but
            was blocked each time (the price condition was not met on-chain at
            execution time, or another transient error occurred). Cancel this
            strategy to free your active job slot — the on-chain cancellation
            takes a moment to confirm.
          </p>
          {job.lastError && (
            <div className="mt-4 text-xs text-orange-400 bg-orange-900/40 rounded-lg p-3 max-h-48 overflow-y-auto">
              <span className="font-semibold block mb-1">Last error:</span>
              <pre className="whitespace-pre-wrap break-all font-mono leading-relaxed">
                {job.lastError}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Page header card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-white">
            {job.type === 'limit_order' ? 'Limit Order' : 'DCA Strategy'}
          </h1>
          <span
            className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold uppercase ${statusCls}`}
          >
            {job.status}
          </span>
        </div>
        {/* Token pair pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
          <TokenIcon tokenMeta={tokenInMeta} size="sm" />
          <span className="text-xs font-semibold text-slate-200">
            {tokenInMeta?.symbol ?? '?'}
          </span>
          <span className="text-slate-500 text-xs mx-1">→</span>
          <TokenIcon tokenMeta={tokenOutMeta} size="sm" />
          <span className="text-xs font-semibold text-slate-200">
            {tokenOutMeta?.symbol ?? '?'}
          </span>
        </div>
        <span className="text-slate-500 font-mono text-xs">ID: {job.id}</span>
      </div>

      {/* Strategy parameters */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Parameters
        </h3>

        <TokenAddressRow
          label="Token In"
          address={job.params.tokenIn}
          tokenMeta={tokenInMeta}
          explorerHref={explorerAddress(job.params.tokenIn)}
        />
        <TokenAddressRow
          label="Token Out"
          address={job.params.tokenOut}
          tokenMeta={tokenOutMeta}
          explorerHref={explorerAddress(job.params.tokenOut)}
        />

        {job.type === 'limit_order' && (
          <>
            <AmountTokenRow
              label="Amount In"
              amount={fmtAmt(job.params.amountIn)}
              tokenMeta={tokenInMeta}
            />
            <TargetPriceRow
              price={job.params.targetPrice}
              tokenInMeta={tokenInMeta}
              tokenOutMeta={tokenOutMeta}
            />
            <AmountTokenRow
              label="Min Out"
              amount={fmtAmt(job.params.minAmountOut)}
              tokenMeta={tokenOutMeta}
            />
            <TriggerRow direction={job.params.direction} />
          </>
        )}

        {job.type === 'dca' && (
          <>
            <AmountTokenRow
              label="Per Swap"
              amount={fmtAmt(job.params.amountPerSwap)}
              tokenMeta={tokenInMeta}
            />
            <Row
              label="Interval"
              value={fmtInterval(job.params.intervalSeconds)}
            />
            <Row
              label="Progress"
              value={`${job.params.swapsCompleted} / ${job.params.totalSwaps} swaps`}
            />
            <Row
              label="Next Run"
              value={
                job.params.nextExecution
                  ? new Date(job.params.nextExecution).toLocaleString()
                  : 'Pending'
              }
            />
          </>
        )}

        <div className="pt-1 border-t border-slate-700 space-y-1">
          <Row
            label="Created"
            value={new Date(job.createdAt).toLocaleString()}
          />
          {job.expiresAt && (
            <Row
              label="Expires"
              value={new Date(job.expiresAt).toLocaleString()}
            />
          )}
          <Row label="Retries" value={`${job.retries} / ${job.maxRetries}`} />
        </div>

        {job.lastError && (
          <div className="mt-4 text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg p-3 max-h-48 overflow-y-auto">
            <span className="font-semibold block mb-1">Last error:</span>
            <pre className="whitespace-pre-wrap break-all font-mono leading-relaxed">
              {job.lastError}
            </pre>
          </div>
        )}
      </section>

      {/* Execution history */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Execution History
          </h3>
          {execList.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-xs text-slate-400">
              {execList.length}
            </span>
          )}
        </div>

        {execList.length === 0 ? (
          <p className="text-sm text-slate-600 italic">
            {isActive
              ? 'This strategy has not yet been executed. The worker checks conditions every 15 s.'
              : 'No executions were recorded for this strategy.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2 pr-4 whitespace-nowrap">Time</th>
                <th className="text-left pb-2">Tx Hash</th>
                <th className="text-right pb-2 pl-4 whitespace-nowrap">
                  Amount Out
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {execList.map((ex) => (
                <tr key={ex.id}>
                  <td className="py-3 pr-4 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(ex.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 font-mono text-xs">
                    {isRealTxHash(ex.txHash) ? (
                      <a
                        href={explorerTx(ex.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-conflux-400 hover:underline break-all"
                      >
                        {ex.txHash}
                      </a>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-700 border border-slate-600 text-slate-400">
                        {ex.txHash}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-right text-xs">
                    {ex.amountOut ? (
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <span className="text-green-400 font-mono">
                          {fmtAmt(ex.amountOut, tokenOutMeta ? undefined : 18)}
                        </span>
                        {tokenOutMeta && (
                          <span className="inline-flex items-center gap-1">
                            <TokenIcon tokenMeta={tokenOutMeta} size="xs" />
                            <span className="text-slate-400">
                              {tokenOutMeta.symbol}
                            </span>
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ─── Shared row layout ───────────────────────────────────────────────────────
// Fixed label width keeps all value chips right-edge aligned.
const LABEL_CLS = 'text-slate-500 text-sm shrink-0 w-32';
const CHIP_CLS =
  'flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 w-full';
// Right-side column: fixed width so every chip/value shares the same right edge.
const VAL_COL = 'w-80 flex-shrink-0 flex justify-end';

function TokenAddressRow({
  label,
  address,
  tokenMeta,
  explorerHref,
}: {
  label: string;
  address: string;
  tokenMeta?: TokenMeta;
  explorerHref: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className={`${LABEL_CLS} pt-2`}>{label}</span>
      {/* group: chip is the link; address slides in below on hover */}
      <div
        className={`group flex flex-col ${VAL_COL.replace('flex justify-end', 'items-end')}`}
      >
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          title={address}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-600 bg-slate-900
                     px-2.5 py-1.5 transition-colors
                     hover:border-conflux-500 hover:bg-slate-800 cursor-pointer"
        >
          <TokenIcon tokenMeta={tokenMeta} />
          <span className="text-slate-100 font-semibold">
            {tokenMeta?.symbol ?? 'Unknown'}
          </span>
          {tokenMeta?.name && (
            <span className="text-slate-400 text-xs">— {tokenMeta.name}</span>
          )}
          {/* external-link indicator */}
          <svg
            className="h-3 w-3 text-slate-500 group-hover:text-conflux-400 transition-colors flex-shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2l-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        {/* full address — hidden by default, revealed on hover */}
        <div className="max-h-0 overflow-hidden group-hover:max-h-16 transition-all duration-200 ease-out w-full text-right mt-0 group-hover:mt-1.5">
          <span className="font-mono text-[11px] text-conflux-400/70 break-all leading-relaxed select-all">
            {address}
          </span>
        </div>
      </div>
    </div>
  );
}

function TokenIcon({
  tokenMeta,
  size = 'md',
}: {
  tokenMeta?: TokenMeta;
  size?: 'xs' | 'sm' | 'md';
}) {
  const dim =
    size === 'xs' ? 'h-3.5 w-3.5' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return tokenMeta?.logoURI ? (
    <img
      src={tokenMeta.logoURI}
      alt={tokenMeta.symbol ?? 'token'}
      className={`${dim} rounded-full bg-white ring-1 ring-slate-600 object-contain flex-shrink-0`}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <span
      className={`${dim} rounded-full bg-slate-700 ring-1 ring-slate-600 flex-shrink-0`}
    />
  );
}

function AmountTokenRow({
  label,
  amount,
  tokenMeta,
}: {
  label: string;
  amount: string;
  tokenMeta?: TokenMeta;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className={LABEL_CLS}>{label}</span>
      <div className={VAL_COL}>
        <div className={CHIP_CLS}>
          <TokenIcon tokenMeta={tokenMeta} />
          <span className="text-slate-100 font-mono font-semibold">
            {amount}
          </span>
          <span className="text-slate-400 text-xs">
            {tokenMeta?.symbol ?? 'token'}
          </span>
          {tokenMeta?.name && (
            <span className="text-slate-500 text-xs truncate">
              — {tokenMeta.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetPriceRow({
  price,
  tokenInMeta,
  tokenOutMeta,
}: {
  price: string;
  tokenInMeta?: TokenMeta;
  tokenOutMeta?: TokenMeta;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className={LABEL_CLS}>Target Price</span>
      <div className={VAL_COL}>
        <div className={CHIP_CLS}>
          <TokenIcon tokenMeta={tokenOutMeta} />
          <span className="text-slate-100 font-mono font-semibold">
            {fmtAmt(price)}
          </span>
          <span className="text-slate-400 text-xs">
            {tokenOutMeta?.symbol ?? '—'}
          </span>
          <span className="text-slate-600 text-xs px-0.5">/</span>
          <TokenIcon tokenMeta={tokenInMeta} />
          <span className="text-slate-400 text-xs">
            {tokenInMeta?.symbol ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TriggerRow({ direction }: { direction: string }) {
  const isGte = direction === 'gte';
  return (
    <div className="flex items-center justify-between gap-6">
      <span className={LABEL_CLS}>Trigger</span>
      <div className={VAL_COL}>
        <div
          className={`${CHIP_CLS} ${
            isGte
              ? 'border-emerald-800/70 bg-emerald-950/40'
              : 'border-amber-800/70 bg-amber-950/40'
          }`}
        >
          <span
            className={`text-base leading-none ${isGte ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {isGte ? '↑' : '↓'}
          </span>
          <span
            className={`text-xs font-medium ${isGte ? 'text-emerald-300' : 'text-amber-300'}`}
          >
            Execute when price {isGte ? '≥' : '≤'} target
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className={LABEL_CLS}>{label}</span>
      <div className={VAL_COL}>
        <span
          className={`text-slate-200 text-right ${mono ? 'font-mono' : ''}`}
          title={full}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
