import type { IncomingMessage, ServerResponse } from 'http';
import buildApp from '../../src/app';

const app = buildApp();
let isReady = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!isReady) {
    await app.ready();
    isReady = true;
  }

  // This function is mounted at /api/v1/submissions on Vercel,
  // but Fastify routes are registered under /v1/submissions.
  if (req.url && req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '') || '/';
  }

  app.server.emit('request', req, res);
}

