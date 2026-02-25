import {
  type Request,
  type Response,
  Router,
  type Router as RouterType,
} from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { adminService } from '../services/admin-service.js';
import { jobService } from '../services/job-service.js';

const router: RouterType = Router();

/** GET /admin/status — current pause state (any signed-in user may read) */
router.get('/status', requireAuth, (_req: Request, res: Response) => {
  res.json({ paused: adminService.isPaused() });
});

/** POST /admin/pause — halt all execution (admin-only) */
router.post('/pause', requireAdmin, async (_req: Request, res: Response) => {
  await adminService.pause();
  res.json({ paused: true });
});

/** POST /admin/resume — resume execution (admin-only) */
router.post('/resume', requireAdmin, async (_req: Request, res: Response) => {
  await adminService.resume();
  res.json({ paused: false });
});

/**
 * GET /admin/jobs — all jobs across all owners (admin-only).
 * Optional query param: ?status=failed|active|pending|executed|cancelled
 */
router.get('/jobs', requireAdmin, async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  const allJobs = await jobService.getAllJobs(status);
  res.json({ jobs: allJobs });
});

export default router;
