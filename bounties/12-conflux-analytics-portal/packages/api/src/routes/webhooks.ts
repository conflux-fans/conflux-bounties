import type { FastifyInstance } from 'fastify';
import { CreateWebhookBody } from '@conflux-analytics/shared';
import { createWebhook } from '../db/queries.js';

/** Webhook subscription routes */
export async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/webhooks — register a daily digest webhook */
  app.post('/webhooks', async (req, reply) => {
    const body = CreateWebhookBody.parse(req.body);
    const sub = await createWebhook(body.url, body.eventType);
    reply.code(201).send(sub);
  });
}
