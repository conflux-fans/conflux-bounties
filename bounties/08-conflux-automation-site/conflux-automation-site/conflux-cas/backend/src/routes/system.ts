/**
 * GET /system/status  (public — no auth required)
 *
 * Returns the liveness and configuration status of all CAS components:
 *  - Backend API (self, always ok if this responds)
 *  - Database    (reachable + job/execution counts)
 *  - Conflux eSpace RPC (block number + round-trip latency)
 *  - Smart contracts   (bytecode present at each address)
 *  - Worker activity   (derived from last execution timestamp in DB)
 *  - System pause flag (from AdminService)
 */

import { count, eq, max } from 'drizzle-orm';
import {
  type Request,
  type Response,
  Router,
  type Router as RouterType,
} from 'express';
import { db } from '../db/client.js';
import { executions, jobs, workerHeartbeat } from '../db/schema.js';
import { adminService } from '../services/admin-service.js';

const router: RouterType = Router();

// ─── Config helpers ───────────────────────────────────────────────────────────

const NETWORK = process.env.NETWORK ?? 'testnet';

const RPC_URL =
  NETWORK === 'mainnet'
    ? (process.env.CONFLUX_ESPACE_MAINNET_RPC ?? 'https://evm.confluxrpc.com')
    : (process.env.CONFLUX_ESPACE_TESTNET_RPC ??
      'https://evmtestnet.confluxrpc.com');

// Known deployed contract addresses (env vars take precedence)
const AUTOMATION_MANAGER =
  process.env.AUTOMATION_MANAGER_ADDRESS ??
  '0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F';
const PRICE_ADAPTER =
  process.env.PRICE_ADAPTER_ADDRESS ??
  '0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9';
const PERMIT_HANDLER =
  process.env.PERMIT_HANDLER_ADDRESS ??
  '0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B';

// Worker is considered "active" if it produced an execution in the last 10 min
const WORKER_ACTIVE_WINDOW_MS = 10 * 60_000;
// "idle" = seen within last 24 h but not the last 10 min
const WORKER_IDLE_WINDOW_MS = 24 * 60 * 60_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkRpc(): Promise<{
  ok: boolean;
  blockNumber?: number;
  latencyMs?: number;
  error?: string;
}> {
  const t0 = Date.now();
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (data.error) return { ok: false, error: data.error.message };
    const blockNumber = data.result ? parseInt(data.result, 16) : undefined;
    return { ok: true, blockNumber, latencyMs };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

async function checkContract(
  address: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (data.error) return { ok: false, error: data.error.message };
    // "0x" or "0x0" means no contract at this address
    const code = data.result ?? '0x';
    if (code === '0x' || code === '0x0' || code.length <= 4) {
      return { ok: false, error: 'No contract deployed at this address' };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

async function checkDatabase(): Promise<{
  ok: boolean;
  jobCount: number;
  executionCount: number;
  pendingJobs: number;
  activeJobs: number;
  failedJobs: number;
  lastExecutionAt?: number;
  workerLastSeenAt?: number;
  error?: string;
}> {
  try {
    const [
      [{ total }],
      [{ execTotal }],
      [{ pending }],
      [{ active }],
      [{ failed }],
      [{ lastTs }],
      heartbeatRows,
    ] = await Promise.all([
      db.select({ total: count() }).from(jobs),
      db.select({ execTotal: count() }).from(executions),
      db
        .select({ pending: count() })
        .from(jobs)
        .where(eq(jobs.status, 'pending')),
      db
        .select({ active: count() })
        .from(jobs)
        .where(eq(jobs.status, 'active')),
      db
        .select({ failed: count() })
        .from(jobs)
        .where(eq(jobs.status, 'failed')),
      db.select({ lastTs: max(executions.timestamp) }).from(executions),
      db.select().from(workerHeartbeat).limit(1),
    ] as const);

    const heartbeatTs = heartbeatRows[0]?.lastSeenAt ?? null;

    return {
      ok: true,
      jobCount: total,
      executionCount: execTotal,
      pendingJobs: pending,
      activeJobs: active,
      failedJobs: failed,
      lastExecutionAt: lastTs ?? undefined,
      workerLastSeenAt: heartbeatTs ?? undefined,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      jobCount: 0,
      executionCount: 0,
      pendingJobs: 0,
      activeJobs: 0,
      failedJobs: 0,
      error: (err as Error).message,
    };
  }
}

function workerStatus(
  workerLastSeenAt: number | undefined
): 'active' | 'idle' | 'unknown' {
  if (!workerLastSeenAt) return 'unknown';
  const age = Date.now() - workerLastSeenAt;
  if (age < WORKER_ACTIVE_WINDOW_MS) return 'active';
  if (age < WORKER_IDLE_WINDOW_MS) return 'idle';
  return 'unknown';
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  const startedAt = process.hrtime.bigint();

  const [rpc, contractAM, contractPA, contractPH, dbStatus] = await Promise.all(
    [
      checkRpc(),
      checkContract(AUTOMATION_MANAGER),
      checkContract(PRICE_ADAPTER),
      checkContract(PERMIT_HANDLER),
      checkDatabase(),
    ]
  );
  const uptimeSeconds = Math.round(process.uptime());

  res.json({
    ts: new Date().toISOString(),
    network: NETWORK,
    backend: {
      ok: true,
      uptimeSeconds,
      uptimeHuman: formatUptime(uptimeSeconds),
    },
    database: {
      ...dbStatus,
      lastExecutionAt: dbStatus.lastExecutionAt
        ? new Date(dbStatus.lastExecutionAt).toISOString()
        : null,
    },
    rpc: { ...rpc, url: RPC_URL },
    contracts: {
      automationManager: { ...contractAM, address: AUTOMATION_MANAGER },
      priceAdapter: { ...contractPA, address: PRICE_ADAPTER },
      permitHandler: { ...contractPH, address: PERMIT_HANDLER },
    },
    worker: {
      status: workerStatus(dbStatus.workerLastSeenAt),
      lastSeenAt: dbStatus.workerLastSeenAt
        ? new Date(dbStatus.workerLastSeenAt).toISOString()
        : null,
      lastExecutionAt: dbStatus.lastExecutionAt
        ? new Date(dbStatus.lastExecutionAt).toISOString()
        : null,
    },
    paused: adminService.isPaused(),
    // How long this status check took (ms)
    checkedInMs: Number((process.hrtime.bigint() - startedAt) / 1_000_000n),
  });
});

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default router;
