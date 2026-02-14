import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

/** Register CORS — allow all origins for the analytics dashboard. */
export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, { origin: true });
}
