import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { activityRoutes } from './activity.js';
import { feesRoutes } from './fees.js';
import { contractsRoutes } from './contracts.js';
import { tokensRoutes } from './tokens.js';
import { dappsRoutes } from './dapps.js';
import { networkRoutes } from './network.js';
import { exportRoutes } from './exports.js';
import { sharesRoutes } from './shares.js';
import { webhooksRoutes } from './webhooks.js';

/**
 * Register all API routes under the /api/v1 prefix.
 * Each route module handles its own Zod validation.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.register(
    async (v1) => {
      await healthRoutes(v1);
      await activityRoutes(v1);
      await feesRoutes(v1);
      await contractsRoutes(v1);
      await tokensRoutes(v1);
      await dappsRoutes(v1);
      await networkRoutes(v1);
      await exportRoutes(v1);
      await sharesRoutes(v1);
      await webhooksRoutes(v1);
    },
    { prefix: '/api/v1' },
  );
}
