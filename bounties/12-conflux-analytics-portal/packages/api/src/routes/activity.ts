import type { FastifyInstance } from 'fastify';
import { DatePaginationQuery } from '@conflux-analytics/shared';
import { getDailyActivity } from '../db/queries.js';

/** GET /api/v1/activity/daily — daily active accounts and tx counts */
export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/activity/daily', async (req) => {
    const query = DatePaginationQuery.parse(req.query);
    const rows = await getDailyActivity(
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
    );
    return { data: rows };
  });
}
