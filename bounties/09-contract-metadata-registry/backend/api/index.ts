import type { IncomingMessage, ServerResponse } from 'http';
import buildApp from '../src/app';

const app = buildApp();
let isReady = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isReady) {
    await app.ready();
    isReady = true;
  }

  if (req.url) {
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api/, '') || '/';
    }
  }

  app.server.emit('request', req, res);
}