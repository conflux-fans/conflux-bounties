import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getApiKeyByKey } from '../db/queries.js';

/**
 * API key authentication hook.
 *
 * If the `x-api-key` header is present, validates it against the
 * `api_keys` table and decorates the request with the resolved key record.
 * Invalid keys receive a 401 response.
 */
export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest('apiKey', null);

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const headerKey = req.headers['x-api-key'] as string | undefined;
    if (!headerKey) return;

    const record = await getApiKeyByKey(headerKey);
    if (!record) {
      reply.code(401).send({ error: 'Invalid API key' });
      return;
    }

    (req as unknown as Record<string, unknown>).apiKey = record;
  });
}
