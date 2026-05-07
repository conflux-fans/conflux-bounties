import type { FastifyInstance } from 'fastify';
import { DatePaginationQuery, PaginationQuery, Address } from '@conflux-analytics/shared';
import { getTokens, getTokenHolders, getTokenStats } from '../db/queries.js';

/** Token analytics routes */
export async function tokensRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/tokens — token list with holder counts */
  app.get('/tokens', async (req) => {
    const query = DatePaginationQuery.parse(req.query);
    const rows = await getTokens(
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
    );
    return { data: rows };
  });

  /** GET /api/v1/tokens/:addr/holders — top holders for a token */
  app.get('/tokens/:addr/holders', async (req) => {
    const { addr } = req.params as { addr: string };
    Address.parse(addr);
    const query = PaginationQuery.parse(req.query);
    const rows = await getTokenHolders(addr.toLowerCase(), {
      limit: query.limit,
      offset: query.offset,
    });
    return { data: rows };
  });

  /** GET /api/v1/tokens/:addr/stats — token daily transfer stats */
  app.get('/tokens/:addr/stats', async (req) => {
    const { addr } = req.params as { addr: string };
    Address.parse(addr);
    const query = DatePaginationQuery.parse(req.query);
    const rows = await getTokenStats(
      addr.toLowerCase(),
      { from: query.from, to: query.to },
      { limit: query.limit, offset: query.offset },
    );
    return { data: rows };
  });
}
