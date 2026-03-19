'use client';

import type { Job } from '@conflux-cas/shared';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Loader2,
  PauseCircle,
  PlayCircle,
  Radio,
  RefreshCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWriteContract } from 'wagmi';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthContext } from '@/lib/auth-context';
import {
  AUTOMATION_MANAGER_ABI,
  AUTOMATION_MANAGER_ADDRESS,
} from '@/lib/contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemStatus {
  ts: string;
  network: string;
  backend: { ok: boolean; uptimeSeconds: number; uptimeHuman: string };
  database: {
    ok: boolean;
    jobCount: number;
    executionCount: number;
    pendingJobs: number;
    activeJobs: number;
    failedJobs: number;
    lastExecutionAt: string | null;
    workerLastSeenAt?: number;
    error?: string;
  };
  rpc: {
    ok: boolean;
    blockNumber?: number;
    latencyMs?: number;
    url: string;
    error?: string;
  };
  contracts: {
    automationManager: { ok: boolean; address: string; error?: string };
    priceAdapter: { ok: boolean; address: string; error?: string };
    permitHandler: { ok: boolean; address: string; error?: string };
  };
  worker: {
    status: 'active' | 'idle' | 'unknown';
    lastSeenAt: string | null;
    lastExecutionAt: string | null;
  };
  paused: boolean;
  checkedInMs: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | Date | null): string {
  if (!iso) return 'never';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type HealthLevel = 'ok' | 'warning' | 'emergency';

// visibleFailedCount: how many non-dismissed failed jobs remain visible.
// This lets the health level resolve to 'ok' once all failures are dismissed.
function computeHealth(
  s: SystemStatus,
  visibleFailedCount: number
): HealthLevel {
  if (s.paused) return 'emergency';
  if (!s.rpc.ok) return 'emergency';
  if (!s.database.ok) return 'emergency';
  if (s.worker.status === 'unknown') return 'emergency';
  if (s.database.jobCount > 0 && visibleFailedCount / s.database.jobCount > 0.3)
    return 'emergency';
  if (s.worker.status === 'idle') return 'warning';
  if (visibleFailedCount > 0) return 'warning';
  if (
    !s.contracts.automationManager.ok ||
    !s.contracts.priceAdapter.ok ||
    !s.contracts.permitHandler.ok
  )
    return 'warning';
  return 'ok';
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = 'cas:safety:dismissed';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {}
}

// ─── Small components ─────────────────────────────────────────────────────────

function Dot({ level }: { level: 'ok' | 'warn' | 'error' | 'unknown' }) {
  const cls = {
    ok: 'bg-emerald-400 shadow-emerald-400/60',
    warn: 'bg-amber-400 shadow-amber-400/60',
    error: 'bg-red-500 shadow-red-500/60',
    unknown: 'bg-slate-500',
  }[level];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor] ${cls}`}
    />
  );
}

function StatusRow({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: 'ok' | 'warn' | 'error' | 'unknown';
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-sm text-slate-300 w-28 shrink-0 font-medium">
        {label}
      </span>
      <Dot level={status} />
      <span className="text-xs text-slate-400 truncate">{detail}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className={`text-3xl font-bold ${accent ?? 'text-white'}`}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const isAdmin = useIsAdmin();
  const { token } = useAuthContext();
  const { writeContractAsync } = useWriteContract();

  const [mounted, setMounted] = useState(false);
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted dismissals once on mount (client-only)
  useEffect(() => {
    setMounted(true);
    setDismissedIds(loadDismissed());
  }, []);

  // When fresh job data arrives, prune dismissed IDs whose jobs are now resolved
  // (executed / cancelled, or active without lastError) — keeps the archive tidy.
  useEffect(() => {
    if (jobs.length === 0) return;
    setDismissedIds((prev) => {
      const problemIds = new Set(
        jobs
          .filter(
            (j) =>
              j.status === 'failed' ||
              ((j.status === 'active' || j.status === 'pending') && j.lastError)
          )
          .map((j) => j.id)
      );
      const pruned = new Set([...prev].filter((id) => problemIds.has(id)));
      if (pruned.size !== prev.size) saveDismissed(pruned);
      return pruned;
    });
  }, [jobs]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function dismissJob(id: string) {
    setDismissedIds((prev) => {
      const next = new Set([...prev, id]);
      saveDismissed(next);
      return next;
    });
  }

  function restoreAll() {
    saveDismissed(new Set());
    setDismissedIds(new Set());
  }

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const [statusRes, jobsRes] = await Promise.all([
        fetch('/api/system/status'),
        token
          ? fetch('/api/admin/jobs', {
              headers: { Authorization: `Bearer ${token}` },
            })
          : Promise.resolve(null),
      ]);

      if (!statusRes.ok)
        throw new Error(`System status: HTTP ${statusRes.status}`);
      setSysStatus((await statusRes.json()) as SystemStatus);

      if (jobsRes?.ok) {
        const payload = (await jobsRes.json()) as { jobs: Job[] };
        setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      }
    } catch (err: unknown) {
      setFetchError((err as Error).message);
    } finally {
      setLoadingStatus(false);
      setLastRefresh(new Date());
    }
  }, [token]);

  useEffect(() => {
    if (!mounted || !isAdmin) return;
    void fetchData();
    intervalRef.current = setInterval(() => void fetchData(), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mounted, isAdmin, fetchData]);

  // ── Pre-hydration ────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-32 rounded bg-slate-800 animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="text-5xl">🔒</div>
        <h2 className="text-2xl font-bold text-white">Access Restricted</h2>
        <p className="text-slate-400 max-w-sm">
          The Safety panel is only accessible to authorised admin addresses.
          Connect the correct wallet and sign in to continue.
        </p>
      </div>
    );
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading system status…</span>
      </div>
    );
  }

  if (fetchError || !sysStatus) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-xl border border-red-800 bg-red-950/30 p-6 flex flex-col gap-3">
        <p className="font-semibold text-red-300 flex items-center gap-2">
          <XCircle className="h-5 w-5" /> Failed to load status
        </p>
        <p className="text-sm text-red-400/80">
          {fetchError ?? 'Unknown error'}
        </p>
        <button
          type="button"
          onClick={() => void fetchData()}
          className="self-start text-sm text-red-300 hover:text-red-200 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const failedJobs = jobs
    .filter((j) => j.status === 'failed')
    .filter((j) => !dismissedIds.has(j.id));
  const activeJobs = jobs.filter(
    (j) => j.status === 'active' || j.status === 'pending'
  );
  // Active / pending jobs that have a lastError (transient but worth seeing)
  const jobsWithErrors = activeJobs
    .filter((j) => j.lastError)
    .filter((j) => !dismissedIds.has(j.id));
  // Dismissed count shown in banner so the admin knows they exist
  const dismissedCount = dismissedIds.size;
  // Health computed AFTER filtering so dismissed jobs don't keep warning lit
  const health = computeHealth(
    sysStatus,
    failedJobs.length + jobsWithErrors.length
  );

  async function handleTogglePause() {
    if (!token) return;
    setPausing(true);
    try {
      await fetch(`/api/admin/${sysStatus!.paused ? 'resume' : 'pause'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } finally {
      setPausing(false);
    }
  }

  async function handleOnChainCancel(onChainJobId: string) {
    await writeContractAsync({
      address: AUTOMATION_MANAGER_ADDRESS,
      abi: AUTOMATION_MANAGER_ABI,
      functionName: 'cancelJob',
      args: [onChainJobId as `0x${string}`],
    });
    await fetchData();
  }

  const workerLevel =
    sysStatus.worker.status === 'active'
      ? 'ok'
      : sysStatus.worker.status === 'idle'
        ? 'warn'
        : 'error';

  return (
    <div className="max-w-3xl space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Safety Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">
            Live operational status · auto-refreshes every 30 s
            {lastRefresh && (
              <span className="ml-2 text-slate-500">
                · updated {timeAgo(lastRefresh)}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Refresh now"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Health banner ──────────────────────────────────────────────────── */}
      {health === 'emergency' && (
        <div className="rounded-xl border border-red-700 bg-red-950/50 p-5 flex items-start gap-4">
          <ShieldAlert className="h-8 w-8 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-bold text-lg">
              🚨 EMERGENCY — Immediate attention required
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-400/80 list-none">
              {sysStatus.paused && (
                <li>• System is globally paused — no jobs are executing</li>
              )}
              {!sysStatus.rpc.ok && (
                <li>• RPC node unreachable: {sysStatus.rpc.error}</li>
              )}
              {!sysStatus.database.ok && (
                <li>• Database error: {sysStatus.database.error}</li>
              )}
              {sysStatus.worker.status === 'unknown' && (
                <li>• Worker has not been seen in over 24 h</li>
              )}
              {sysStatus.database.jobCount > 0 &&
                sysStatus.database.failedJobs / sysStatus.database.jobCount >
                  0.3 && (
                  <li>
                    •{' '}
                    {Math.round(
                      (sysStatus.database.failedJobs /
                        sysStatus.database.jobCount) *
                        100
                    )}
                    % of jobs are in a failed state
                  </li>
                )}
            </ul>
          </div>
        </div>
      )}

      {health === 'warning' && (
        <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-5 space-y-4">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-7 w-7 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 font-semibold text-lg">
                ⚠ Warning — Review recommended
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-400/80 list-none">
                {sysStatus.worker.status === 'idle' && (
                  <li>• Worker has not executed in the last 10 minutes</li>
                )}
                {(failedJobs.length > 0 ||
                  sysStatus.database.failedJobs > 0) && (
                  <li>
                    •{' '}
                    {failedJobs.length > 0
                      ? failedJobs.length
                      : sysStatus.database.failedJobs}{' '}
                    job(s) in failed state
                    {dismissedCount > 0 && (
                      <span className="text-amber-500/60">
                        {' '}
                        ({dismissedCount} dismissed)
                      </span>
                    )}
                    {' — '}
                    <span className="underline decoration-dotted">
                      see below
                    </span>
                  </li>
                )}
                {jobsWithErrors.length > 0 && (
                  <li>
                    • {jobsWithErrors.length} active job(s) with recent errors —{' '}
                    <span className="underline decoration-dotted">
                      see below
                    </span>
                  </li>
                )}
                {(!sysStatus.contracts.automationManager.ok ||
                  !sysStatus.contracts.priceAdapter.ok) && (
                  <li>
                    • One or more contracts not found at configured address
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {health === 'ok' && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
          <div>
            <p className="text-emerald-300 font-semibold">
              All systems operational
            </p>
            <p className="text-emerald-400/60 text-xs mt-0.5">
              Worker active · RPC reachable · no failed jobs
            </p>
          </div>
        </div>
      )}

      {/* ── Job statistics ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Job Statistics (all users)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={sysStatus.database.jobCount} />
          <StatCard
            label="Pending"
            value={sysStatus.database.pendingJobs}
            accent={
              sysStatus.database.pendingJobs > 0
                ? 'text-yellow-300'
                : 'text-slate-300'
            }
          />
          <StatCard
            label="Active"
            value={sysStatus.database.activeJobs}
            accent={
              sysStatus.database.activeJobs > 0
                ? 'text-emerald-300'
                : 'text-slate-300'
            }
          />
          <StatCard
            label="Failed"
            value={sysStatus.database.failedJobs}
            accent={
              sysStatus.database.failedJobs > 0
                ? 'text-red-400'
                : 'text-slate-300'
            }
          />
          <StatCard
            label="Executions"
            value={sysStatus.database.executionCount}
            sub={
              sysStatus.worker.lastExecutionAt
                ? `last: ${timeAgo(sysStatus.worker.lastExecutionAt)}`
                : undefined
            }
          />
        </div>
      </section>

      {/* ── Component health ───────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Component Health
        </h3>
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 px-4 divide-y divide-slate-800">
          <StatusRow
            icon={<Activity className="h-4 w-4" />}
            label="Worker"
            status={workerLevel}
            detail={
              sysStatus.worker.status === 'active'
                ? `Active · last seen ${timeAgo(sysStatus.worker.lastSeenAt)}`
                : sysStatus.worker.status === 'idle'
                  ? `Idle · last seen ${timeAgo(sysStatus.worker.lastSeenAt)}`
                  : 'Not seen in the last 24 h'
            }
          />
          <StatusRow
            icon={<Wifi className="h-4 w-4" />}
            label="RPC Node"
            status={sysStatus.rpc.ok ? 'ok' : 'error'}
            detail={
              sysStatus.rpc.ok
                ? `Block #${sysStatus.rpc.blockNumber?.toLocaleString()} · ${sysStatus.rpc.latencyMs} ms`
                : (sysStatus.rpc.error ?? 'Unreachable')
            }
          />
          <StatusRow
            icon={<Database className="h-4 w-4" />}
            label="Database"
            status={sysStatus.database.ok ? 'ok' : 'error'}
            detail={
              sysStatus.database.ok
                ? `${sysStatus.database.jobCount} jobs · ${sysStatus.database.executionCount} executions`
                : (sysStatus.database.error ?? 'Error')
            }
          />
          <StatusRow
            icon={<Server className="h-4 w-4" />}
            label="Backend"
            status="ok"
            detail={`Uptime ${sysStatus.backend.uptimeHuman} · ${sysStatus.network}`}
          />
          <StatusRow
            icon={<Radio className="h-4 w-4" />}
            label="Contracts"
            status={
              sysStatus.contracts.automationManager.ok &&
              sysStatus.contracts.priceAdapter.ok &&
              sysStatus.contracts.permitHandler.ok
                ? 'ok'
                : 'warn'
            }
            detail={
              sysStatus.contracts.automationManager.ok &&
              sysStatus.contracts.priceAdapter.ok &&
              sysStatus.contracts.permitHandler.ok
                ? 'AutomationManager · PriceAdapter · PermitHandler — all present'
                : [
                    !sysStatus.contracts.automationManager.ok &&
                      'AutomationManager ✗',
                    !sysStatus.contracts.priceAdapter.ok && 'PriceAdapter ✗',
                    !sysStatus.contracts.permitHandler.ok && 'PermitHandler ✗',
                  ]
                    .filter(Boolean)
                    .join(' · ')
            }
          />
          <StatusRow
            icon={<Clock className="h-4 w-4" />}
            label="Pause State"
            status={sysStatus.paused ? 'error' : 'ok'}
            detail={
              sysStatus.paused
                ? '🔴 GLOBALLY PAUSED — no jobs will execute'
                : '🟢 Running normally'
            }
          />
        </div>
      </section>

      {/* ── Failed jobs ────────────────────────────────────────────────────── */}
      {(failedJobs.length > 0 || sysStatus.database.failedJobs > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Failed Jobs{' '}
              <span className="text-red-400 normal-case">
                ({sysStatus.database.failedJobs})
              </span>
            </h3>
            {dismissedIds.size > 0 && (
              <button
                type="button"
                onClick={restoreAll}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Restore {dismissedIds.size} dismissed
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {failedJobs.map((j) => {
              const isExpanded = expandedIds.has(j.id);
              return (
                <div
                  key={j.id}
                  className="rounded-lg border border-red-800/40 bg-red-950/20 overflow-hidden"
                >
                  {/* Compact header row — always visible */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(j.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="font-mono text-xs text-slate-400 truncate">
                        {j.id.slice(0, 26)}…
                      </span>
                      <span className="text-[10px] font-semibold uppercase bg-slate-700 rounded px-1.5 py-0.5 text-slate-300 shrink-0">
                        {j.type === 'limit_order' ? 'Limit' : 'DCA'}
                      </span>
                    </button>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {j.retries}/{j.maxRetries}
                    </span>
                    {j.lastError && (
                      <span className="text-xs text-red-400/70 truncate max-w-[180px] shrink-0 hidden sm:block">
                        {j.lastError.slice(0, 60)}
                        {j.lastError.length > 60 ? '…' : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(j.id)}
                      className="text-slate-600 hover:text-slate-300 shrink-0 text-xs px-1 transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissJob(j.id)}
                      className="text-slate-600 hover:text-red-400 shrink-0 transition-colors"
                      title="Dismiss"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Expanded error detail */}
                  {isExpanded && (
                    <div className="border-t border-red-800/30 px-3 py-2 bg-red-950/30">
                      <p className="text-xs text-red-400/90 leading-relaxed break-all max-h-40 overflow-y-auto">
                        {j.lastError ?? 'No error message recorded'}
                      </p>
                      <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
                        <span>Owner: {j.owner.slice(0, 10)}…</span>
                        <span>Updated: {timeAgo(new Date(j.updatedAt))}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {dismissedIds.size > 0 && (
              <p className="text-xs text-slate-600 pl-1">
                {dismissedIds.size} job(s) dismissed from view
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Active jobs with errors ─────────────────────────────────────────── */}
      {jobsWithErrors.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Active Jobs with Errors{' '}
            <span className="text-amber-400 normal-case">
              ({jobsWithErrors.length})
            </span>
          </h3>
          <div className="space-y-1.5">
            {jobsWithErrors.map((j) => {
              const isExpanded = expandedIds.has(j.id);
              return (
                <div
                  key={j.id}
                  className="rounded-lg border border-amber-800/30 bg-amber-950/10 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(j.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="font-mono text-xs text-slate-400 truncate">
                        {j.id.slice(0, 26)}…
                      </span>
                      <span className="text-[10px] font-semibold uppercase bg-slate-700 rounded px-1.5 py-0.5 text-slate-300 shrink-0">
                        {j.type === 'limit_order' ? 'Limit' : 'DCA'}
                      </span>
                    </button>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {j.retries}/{j.maxRetries}
                    </span>
                    {j.lastError && (
                      <span className="text-xs text-amber-400/70 truncate max-w-[180px] shrink-0 hidden sm:block">
                        {j.lastError.slice(0, 60)}
                        {j.lastError.length > 60 ? '…' : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(j.id)}
                      className="text-slate-600 hover:text-slate-300 shrink-0 text-xs px-1 transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissJob(j.id)}
                      className="text-slate-600 hover:text-amber-400 shrink-0 transition-colors"
                      title="Dismiss"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-amber-800/20 px-3 py-2 bg-amber-950/20">
                      <p className="text-xs text-amber-400/80 leading-relaxed break-all max-h-40 overflow-y-auto">
                        {j.lastError}
                      </p>
                      <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
                        <span>Owner: {j.owner.slice(0, 10)}…</span>
                        <span>Updated: {timeAgo(new Date(j.updatedAt))}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Admin controls ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-orange-800/60 bg-orange-950/20 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-orange-400" />
          <h3 className="text-sm font-semibold text-orange-300 uppercase tracking-wider">
            Admin Controls
          </h3>
        </div>

        {/* Global Pause / Resume */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-white">
              {sysStatus.paused
                ? '🔴 System is globally paused'
                : '🟢 System is running'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sysStatus.paused
                ? 'All job execution is halted. Resume to restart the worker.'
                : 'Pause halts ALL job execution immediately for all users.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleTogglePause()}
            disabled={pausing}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
              sysStatus.paused
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'bg-red-700 hover:bg-red-600 text-white'
            }`}
          >
            {pausing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sysStatus.paused ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
            {sysStatus.paused ? 'Resume All Execution' : 'Pause All Execution'}
          </button>
        </div>

        {/* Emergency on-chain cancel for stuck active jobs */}
        {activeJobs.filter((j) => j.onChainJobId && j.lastError).length > 0 && (
          <div>
            <p className="text-xs text-orange-300/80 mb-2 font-medium">
              Active jobs with errors — on-chain cancel available:
            </p>
            <div className="space-y-1.5">
              {activeJobs
                .filter((j) => j.onChainJobId && j.lastError)
                .slice(0, 5)
                .map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 gap-3"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-slate-400 block truncate">
                        {j.id.slice(0, 28)}…
                      </span>
                      <span className="text-[10px] text-amber-400/70 block truncate">
                        {j.lastError}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        j.onChainJobId &&
                        void handleOnChainCancel(j.onChainJobId)
                      }
                      className="shrink-0 text-xs text-red-400 hover:text-red-300 border border-red-800/60 rounded px-2 py-1 transition-colors whitespace-nowrap"
                    >
                      Cancel on-chain
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Footer metadata ─────────────────────────────────────────────────── */}
      <p className="text-xs text-slate-600 text-right">
        Status checked in {sysStatus.checkedInMs} ms · network:{' '}
        {sysStatus.network}
      </p>
    </div>
  );
}
