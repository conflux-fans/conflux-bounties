import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerCache } from './plugins/cache.js';
import { registerAuth } from './plugins/auth.js';
import { registerRoutes } from './routes/index.js';
import { closePool } from './db/connection.js';

/**
 * Build and start the Fastify API server.
 */
async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  /** OpenAPI documentation */
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Conflux Analytics API',
        version: '1.0.0',
        description: 'On-chain analytics for Conflux eSpace',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  /** Plugins */
  await registerCors(app);
  await registerRateLimit(app);
  await registerCache(app);
  await registerAuth(app);

  /** Routes */
  await registerRoutes(app);

  /** Global Zod error handler */
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    reply.code(error.statusCode ?? 500).send({ error: error.message });
  });

  /** Start */
  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await app.listen({ port, host });
  console.log(`[api] Listening on ${host}:${port}`);
  console.log(`[api] Docs at http://localhost:${port}/docs`);

  /** Graceful shutdown */
  const shutdown = async () => {
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[api] Fatal:', err);
  process.exit(1);
});
