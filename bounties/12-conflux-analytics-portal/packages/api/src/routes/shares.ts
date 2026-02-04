import type { FastifyInstance } from 'fastify';
import { CreateShareBody } from '@conflux-analytics/shared';
import { generateSlug } from '@conflux-analytics/shared';
import { createSharedView, getSharedView } from '../db/queries.js';

/** Share link routes */
export async function sharesRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/shares — create a shareable view */
  app.post('/shares', async (req, reply) => {
    const body = CreateShareBody.parse(req.body);
    const slug = generateSlug();

    await createSharedView(slug, body.config, body.expiresInDays);

    reply.code(201).send({ slug, url: `/s/${slug}` });
  });

  /** GET /api/v1/shares/:slug — retrieve a shared view */
  app.get('/shares/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const view = await getSharedView(slug);

    if (!view) {
      reply.code(404).send({ error: 'Share not found or expired' });
      return;
    }

    return view;
  });
}
