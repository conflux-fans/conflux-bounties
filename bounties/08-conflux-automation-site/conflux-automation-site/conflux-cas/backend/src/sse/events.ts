import type { Job } from '@conflux-cas/shared';
import {
  type Request,
  type Response,
  Router,
  type Router as RouterType,
} from 'express';
import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../middleware/auth.js';
import { jobService } from '../services/job-service.js';

type SseClient = { res: Response; address: string };

const clients: SseClient[] = [];
const router: RouterType = Router();

/** Push a job update to all SSE clients watching the given owner address. */
export function pushJobUpdate(job: Job): void {
  const payload = `data: ${JSON.stringify({ type: 'job_update', job })}\n\n`;
  for (const client of clients) {
    if (client.address.toLowerCase() === job.owner.toLowerCase()) {
      client.res.write(payload);
    }
  }
}

// ─── Background DB poller ────────────────────────────────────────────────────
// The worker updates SQLite directly (bypassing the REST API), so pushJobUpdate
// is never called for worker-triggered state changes.  This poller detects rows
// whose updatedAt has advanced since the last tick and pushes them to any
// connected SSE client that owns the job.
let _lastPollMs = Date.now();

setInterval(async () => {
  // Skip if nobody is listening — avoids pointless DB reads
  if (clients.length === 0) {
    _lastPollMs = Date.now();
    return;
  }
  const since = _lastPollMs - 2_000; // 2s overlap to avoid missing updates at boundary
  _lastPollMs = Date.now();
  try {
    const updated = await jobService.getJobsUpdatedSince(since);
    for (const job of updated) pushJobUpdate(job);
  } catch {
    // Non-fatal — next tick will pick up any missed updates
  }
}, 15_000);

/** GET /sse/jobs — Server-Sent Events stream for real-time job updates.
 *  Accepts Bearer token via Authorization header OR ?token= query param
 *  (EventSource API cannot set custom headers). */
router.get('/jobs', (req: Request, res: Response) => {
  const JWT_SECRET =
    process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

  // Extract token from header or query param
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const queryToken =
    typeof req.query.token === 'string' ? req.query.token : undefined;
  const rawToken = headerToken ?? queryToken;

  if (!rawToken) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  let user: AuthPayload;
  try {
    user = jwt.verify(rawToken, JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client: SseClient = { res, address: user.address };
  clients.push(client);

  // Send initial snapshot of active jobs
  void (async () => {
    try {
      const jobs = await jobService.getJobsByOwner(user.address);
      for (const job of jobs) {
        res.write(`data: ${JSON.stringify({ type: 'job_update', job })}\n\n`);
      }
    } catch {
      // non-fatal — client will fetch separately
    }
  })();

  // Heartbeat every 30s to keep the connection alive
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

export default router;
