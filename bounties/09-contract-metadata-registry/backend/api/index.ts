import type { VercelRequest, VercelResponse } from '@vercel/node';
import buildApp from '../src/app';

const app = buildApp();
let isReady = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isReady) {
    await app.ready();
    isReady = true;
  }
  // Delegate to Fastify's HTTP server
  app.server.emit('request', req, res);
}