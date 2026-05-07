import type { FastifyInstance } from 'fastify';
import { ContractsQuery, DatePaginationQuery, Address } from '@conflux-analytics/shared';
import { getTopContracts, getContractStats } from '../db/queries.js';

/** Contract analytics routes */
export async function contractsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/contracts/top — top contracts leaderboard */
  app.get('/contracts/top', async (req) => {
    const query = ContractsQuery.parse(req.query);
    const rows = await getTopContracts(
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
      query.sort,
      query.order,
    );
    return { data: rows };
  });

  /** GET /api/v1/contracts/:addr/stats — single contract daily stats */
  app.get('/contracts/:addr/stats', async (req) => {
    const { addr } = req.params as { addr: string };
    Address.parse(addr);
    const query = DatePaginationQuery.parse(req.query);
    const rows = await getContractStats(
      addr.toLowerCase(),
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
    );
    return { data: rows };
  });
}
