import type { IncomingMessage, ServerResponse } from 'http';
import buildApp from '../src/app';

const app = buildApp();
let isReady = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS headers for all responses
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

  // On Vercel, this function is mounted at /api/*, so incoming URLs are /api/...
  // Fastify routes are registered at /v1/*, so strip the /api prefix before handing off.
  if (req.url) {
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api/, '') || '/';
    }
  }

  app.server.emit('request', req, res);
}

