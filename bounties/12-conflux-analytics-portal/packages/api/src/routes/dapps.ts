import type { FastifyInstance } from 'fastify';
import { DatePaginationQuery } from '@conflux-analytics/shared';
import { z } from 'zod';
import { getDappLeaderboard } from '../db/queries.js';

/** DApp leaderboard query with optional category filter */
const DappQuery = DatePaginationQuery.extend({
  category: z.string().optional(),
});

/** DApp analytics routes */
export async function dappsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/dapps/leaderboard — DApp leaderboard by category */
  app.get('/dapps/leaderboard', async (req) => {
    const query = DappQuery.parse(req.query);
    const rows = await getDappLeaderboard(
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
      query.category,
    );
    return { data: rows };
  });
}
