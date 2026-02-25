import { eq } from 'drizzle-orm';
import {
  type Request,
  type Response,
  Router,
  type Router as RouterType,
} from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { executions } from '../db/schema.js';
import { type AuthPayload, requireAuth } from '../middleware/auth.js';
import { jobService } from '../services/job-service.js';

type AuthRequest = Request & { user?: AuthPayload };

const router: RouterType = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const LimitOrderSchema = z.object({
  tokenIn: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokenOut: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amountIn: z.string().regex(/^\d+$/),
  minAmountOut: z.string().regex(/^\d+$/),
  targetPrice: z.string().regex(/^\d+$/),
  direction: z.enum(['gte', 'lte']),
});

const DCAParamsSchema = z.object({
  tokenIn: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokenOut: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amountPerSwap: z.string().regex(/^\d+$/),
  intervalSeconds: z.number().int().min(60),
  totalSwaps: z.number().int().min(1),
  swapsCompleted: z.number().int().default(0),
  nextExecution: z.number().default(0),
});

const CreateJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('limit_order'),
    params: LimitOrderSchema,
    expiresAt: z.number().optional(),
    maxRetries: z.number().optional(),
    onChainJobId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  }),
  z.object({
    type: z.literal('dca'),
    params: DCAParamsSchema,
    expiresAt: z.number().optional(),
    maxRetries: z.number().optional(),
    onChainJobId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  }),
]);

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /jobs — list caller's jobs */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const jobs = await jobService.getJobsByOwner(user.address);
  res.json({ jobs });
});

/** GET /jobs/:id — get single job (owner only) */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const job = await jobService.getJob(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (job.owner.toLowerCase() !== user.address.toLowerCase()) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ job });
});

/** GET /jobs/:id/executions — execution history for a job (owner only) */
router.get(
  '/:id/executions',
  requireAuth,
  async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user!;
    const job = await jobService.getJob(req.params.id as string);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (job.owner.toLowerCase() !== user.address.toLowerCase()) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const rows = await db
      .select()
      .from(executions)
      .where(eq(executions.jobId, job.id))
      .orderBy(executions.timestamp);
    res.json({ executions: rows });
  }
);

/** POST /jobs — create a new job */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;
  const job = await jobService.createJob({ ...input, owner: user.address });
  res.status(201).json({ job });
});

/** DELETE /jobs/:id — cancel a job (owner only) */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const result = await jobService.cancelJob(
    req.params.id as string,
    user.address
  );
  if (result === 'forbidden') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!result) {
    res.status(404).json({ error: 'Job not found or not cancellable' });
    return;
  }
  res.json({ job: result });
});

export default router;
