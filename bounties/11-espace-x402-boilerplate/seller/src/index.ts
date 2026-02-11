/**
 * x402 Seller API — Hono server
 *
 * Endpoints:
 *   GET /health         — Health check (free)
 *   GET /data/free      — Free data endpoint
 *   GET /data/premium   — Premium data (x402-gated)
 *   GET /ai?q=...       — AI query (x402-gated)
 *   GET /tokens         — Available tokens for payment
 *
 * @package x402-fullstack
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { getNetwork } from './config/networks.js';
import { health } from './routes/health.js';
import { data } from './routes/data.js';
import { ai } from './routes/ai.js';
import { payments } from './routes/payments.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const app = new Hono();

// CORS — allow any origin for agent/scanner access
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'PAYMENT-SIGNATURE'],
  exposeHeaders: [
    'PAYMENT-REQUIRED', 'PAYMENT-RESPONSE',
    'X-Payment-Amount', 'X-Payment-Token', 'X-Payment-Nonce',
    'X-Payment-Expiry', 'X-Payment-Endpoint', 'X-Payment-Invoice-Id',
  ],
}));

// Rate limiting (60 req/min per IP for paid endpoints)
app.use('/data/premium', rateLimiter(60));
app.use('/ai', rateLimiter(30));

// Routes
app.route('/health', health);
app.route('/data', data);
app.route('/ai', ai);
app.route('/payments', payments);

// Token list endpoint
app.get('/tokens', (c) => {
  const networkName = c.req.query('network') || env.network;
  const network = getNetwork(networkName);
  return c.json({
    network: networkName,
    chainId: network.chainId,
    tokens: Object.entries(network.tokens).map(([symbol, t]) => ({
      symbol,
      name: t.name,
      address: t.address,
      decimals: t.decimals,
      paymentMethod: t.paymentMethod,
      pricePerQuery: t.pricePerQuery,
    })),
  });
});

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Start
const network = getNetwork(env.network);

console.log(`[seller] x402 Seller API v1.0.0`);
console.log(`[seller] Network: ${network.name} (chain ${network.chainId})`);
console.log(`[seller] Tokens: ${Object.keys(network.tokens).join(', ')}`);
console.log(`[seller] Treasury: ${env.treasury}`);

serve({ fetch: app.fetch, port: env.sellerPort }, () => {
  console.log(`[seller] Listening on http://localhost:${env.sellerPort}`);
  console.log(`[seller] Endpoints:`);
  console.log(`  GET /health            (free)`);
  console.log(`  GET /data/free         (free)`);
  console.log(`  GET /data/premium      (x402)`);
  console.log(`  GET /ai?q=...          (x402)`);
  console.log(`  GET /tokens            (free)`);
  console.log(`  GET /payments/history   (free)`);
  console.log(`  GET /payments/stats     (free)`);
});
