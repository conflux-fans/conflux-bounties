import type { FastifyInstance } from 'fastify';
import { ExportQuery } from '@conflux-analytics/shared';
import { toCsv } from '@conflux-analytics/shared';
import {
  getDailyActivity,
  getDailyFees,
  getTopContracts,
  getTokens,
  getDappLeaderboard,
} from '../db/queries.js';

/** Widget name → data fetcher mapping */
const WIDGET_FETCHERS: Record<string, (range: { from?: string; to?: string }) => Promise<unknown[]>> = {
  activity: (r) => getDailyActivity(r, { limit: 10000, offset: 0 }),
  fees: (r) => getDailyFees(r, { limit: 10000, offset: 0 }),
  contracts: (r) => getTopContracts(r, { limit: 10000, offset: 0 }, 'tx_count', 'desc'),
  tokens: (r) => getTokens(r, { limit: 10000, offset: 0 }),
  dapps: (r) => getDappLeaderboard(r, { limit: 10000, offset: 0 }),
};

/** Export routes — CSV/JSON download for any widget */
export async function exportRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/export/:widget — download data as CSV or JSON */
  app.get('/export/:widget', async (req, reply) => {
    const { widget } = req.params as { widget: string };
    const query = ExportQuery.parse(req.query);

    const fetcher = WIDGET_FETCHERS[widget];
    if (!fetcher) {
      reply.code(400).send({ error: `Unknown widget: ${widget}` });
      return;
    }

    const rows = await fetcher({ from: query.from, to: query.to }) as Record<string, unknown>[];

    if (query.format === 'csv') {
      const csv = toCsv(rows);
      reply
        .header('content-type', 'text/csv')
        .header('content-disposition', `attachment; filename="${widget}.csv"`)
        .send(csv);
      return;
    }

    return { data: rows };
  });
}
