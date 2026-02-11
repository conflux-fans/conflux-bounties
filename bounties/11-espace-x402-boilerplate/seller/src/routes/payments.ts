/**
 * Payment history and stats endpoints (free, no payment required)
 *
 * GET /payments/history?network=eip155:71&limit=50&offset=0
 * GET /payments/stats?network=eip155:71
 */

import { Hono } from 'hono';
import { getHistory, getStats } from '../services/payments.js';

const payments = new Hono();

payments.get('/history', async (c) => {
  try {
    const network = c.req.query('network') || undefined;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await getHistory({ network, limit, offset });
    return c.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[payments] History error:', err.message);
    return c.json({ error: 'Failed to fetch payment history' }, 500);
  }
});

payments.get('/stats', async (c) => {
  try {
    const network = c.req.query('network') || undefined;
    const stats = await getStats(network);
    return c.json({ success: true, ...stats });
  } catch (err: any) {
    console.error('[payments] Stats error:', err.message);
    return c.json({ error: 'Failed to fetch payment stats' }, 500);
  }
});

export { payments };
