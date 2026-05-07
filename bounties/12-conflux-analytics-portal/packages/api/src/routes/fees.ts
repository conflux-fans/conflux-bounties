import type { FastifyInstance } from 'fastify';
import { DatePaginationQuery } from '@conflux-analytics/shared';
import { getDailyFees } from '../db/queries.js';

/** GET /api/v1/fees/daily — daily gas prices, burned fees, tips */
export async function feesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/fees/daily', async (req) => {
    const query = DatePaginationQuery.parse(req.query);
    const rows = await getDailyFees(
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
    );
    return { data: rows };
  });
}
