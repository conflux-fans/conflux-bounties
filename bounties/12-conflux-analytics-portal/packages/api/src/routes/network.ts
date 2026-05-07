import type { FastifyInstance } from 'fastify';
import { DateRangeQuery } from '@conflux-analytics/shared';
import { getNetworkOverview, getTransactionStats } from '../db/queries.js';

/** Network-level analytics routes */
export async function networkRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/network/overview — latest block, TPS, totals */
  app.get('/network/overview', async () => {
    const overview = await getNetworkOverview();
    return {
      latestBlock: Number(overview.latest_block ?? 0),
      tps: Number(overview.tps ?? 0),
      totalTransactions: Number(overview.total_transactions ?? 0),
      avgBlockTime: Number(overview.avg_block_time ?? 0),
    };
  });

  /** GET /api/v1/transactions/stats — success/failure rates */
  app.get('/transactions/stats', async (req) => {
    const range = DateRangeQuery.parse(req.query);
    const stats = await getTransactionStats({ from: range.from, to: range.to });
    return {
      totalSuccess: Number(stats.total_success ?? 0),
      totalFailure: Number(stats.total_failure ?? 0),
      successRate: Number(stats.success_rate ?? 0),
    };
  });
}
