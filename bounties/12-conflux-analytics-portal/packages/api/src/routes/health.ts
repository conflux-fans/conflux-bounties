import type { FastifyInstance } from 'fastify';
import { getHealth } from '../db/queries.js';

/** GET /api/v1/health — sync status and health check */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const state = await getHealth();
    return {
      status: 'ok',
      lastBlock: Number(state.last_block),
      lastBlockHash: state.last_block_hash,
      updatedAt: state.updated_at,
    };
  });
}
