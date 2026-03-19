/**
 * Backend integration tests — uses supertest to exercise routes against
 * a real SQLite database in a temp directory (set by setup.ts).
 */

import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { signToken } from '../middleware/auth.js';

// Import app after setup.ts has set DATABASE_PATH and JWT_SECRET
let app: import('express').Express;

beforeAll(async () => {
  // Dynamic import so setup.ts env vars are set first
  const mod = await import('../index.js');
  app = mod.app;
});

// ────────────────────────────────────────────────────────────────────────────
// Health check
// ────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────────────

describe('Auth routes', () => {
  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b8D4C9b3e2Fec0b3F1';

  it('GET /auth/nonce — returns nonce for valid address', async () => {
    const res = await request(app).get(`/auth/nonce?address=${TEST_ADDRESS}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.nonce).toBe('string');
    expect(res.body.nonce.length).toBeGreaterThan(0);
  });

  it('GET /auth/nonce — 400 for missing address', async () => {
    const res = await request(app).get('/auth/nonce');
    expect(res.status).toBe(400);
  });

  it('GET /auth/nonce — 400 for malformed address', async () => {
    const res = await request(app).get('/auth/nonce?address=not-an-address');
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Jobs — unauthenticated
// ────────────────────────────────────────────────────────────────────────────

describe('Jobs routes — unauthenticated', () => {
  it('GET /jobs — 401 without token', async () => {
    const res = await request(app).get('/jobs');
    expect(res.status).toBe(401);
  });

  it('POST /jobs — 401 without token', async () => {
    const res = await request(app).post('/jobs').send({ type: 'limit_order' });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Jobs — authenticated
// ────────────────────────────────────────────────────────────────────────────

describe('Jobs routes — authenticated', () => {
  const OWNER = '0x742d35Cc6634C0532925a3b8D4C9b3e2Fec0b3F1';
  let auth: string;

  beforeAll(() => {
    const token = signToken(OWNER);
    auth = `Bearer ${token}`;
  });

  const LIMIT_ORDER_PAYLOAD = {
    type: 'limit_order',
    params: {
      tokenIn: '0x14b2D3bC3321f9b9ce0c9b3bC60efFBD20ce5Ca2',
      tokenOut: '0x7B1B2b764373b3b8Ad576B1c91E10f16b2b7b0f3',
      amountIn: '1000000000000000000',
      minAmountOut: '990000000000000000',
      targetPrice: '1000000000000000000',
      direction: 'lte',
    },
    expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24h
  };

  const DCA_PAYLOAD = {
    type: 'dca',
    params: {
      tokenIn: '0x14b2D3bC3321f9b9ce0c9b3bC60efFBD20ce5Ca2',
      tokenOut: '0x7B1B2b764373b3b8Ad576B1c91E10f16b2b7b0f3',
      amountPerSwap: '500000000000000000',
      intervalSeconds: 3600,
      totalSwaps: 10,
      swapsCompleted: 0,
      nextExecution: Date.now(),
    },
  };

  let createdJobId: string;
  let createdDcaJobId: string;

  it('POST /jobs — creates limit order', async () => {
    const res = await request(app)
      .post('/jobs')
      .set('Authorization', auth)
      .send(LIMIT_ORDER_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.job).toBeDefined();
    expect(res.body.job.type).toBe('limit_order');
    expect(res.body.job.owner.toLowerCase()).toBe(OWNER.toLowerCase());
    createdJobId = res.body.job.id;
  });

  it('POST /jobs — creates DCA job', async () => {
    const res = await request(app)
      .post('/jobs')
      .set('Authorization', auth)
      .send(DCA_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.job.type).toBe('dca');
    createdDcaJobId = res.body.job.id;
  });

  it('POST /jobs — 400 for invalid payload (missing tokenIn)', async () => {
    const res = await request(app)
      .post('/jobs')
      .set('Authorization', auth)
      .send({
        type: 'limit_order',
        params: {
          /* missing tokenIn */ tokenOut:
            '0x7B1B2b764373b3b8Ad576B1c91E10f16b2b7b0f3',
          amountIn: '1',
          minAmountOut: '1',
          targetPrice: '1',
          direction: 'lte',
        },
      });
    expect(res.status).toBe(400);
  });

  it('GET /jobs — returns list with created jobs', async () => {
    const res = await request(app).get('/jobs').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /jobs/:id — returns specific job', async () => {
    const res = await request(app)
      .get(`/jobs/${createdJobId}`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.job.id).toBe(createdJobId);
  });

  it('GET /jobs/:id — 404 for unknown id', async () => {
    const res = await request(app)
      .get('/jobs/nonexistent-id')
      .set('Authorization', auth);
    expect(res.status).toBe(404);
  });

  it('DELETE /jobs/:id — cancels job', async () => {
    const res = await request(app)
      .delete(`/jobs/${createdDcaJobId}`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('cancelled');
  });

  it('DELETE /jobs/:id — 404 for already-cancelled job re-cancel', async () => {
    const res = await request(app)
      .delete(`/jobs/${createdDcaJobId}`)
      .set('Authorization', auth);
    // Already cancelled — service returns null
    expect(res.status).toBe(404);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Auth isolation — other user cannot see jobs
// ────────────────────────────────────────────────────────────────────────────

describe('Jobs — access control', () => {
  const OWNER_A = '0x742d35Cc6634C0532925a3b8D4C9b3e2Fec0b3F1';
  const OWNER_B = '0xAbCd1234567890AbCd1234567890AbCd12345678';

  let authA: string;
  let authB: string;
  let jobIdA: string;

  beforeAll(async () => {
    authA = `Bearer ${signToken(OWNER_A)}`;
    authB = `Bearer ${signToken(OWNER_B)}`;

    // Create a job as owner A
    const res = await request(app)
      .post('/jobs')
      .set('Authorization', authA)
      .send({
        type: 'limit_order',
        params: {
          tokenIn: '0x14b2D3bC3321f9b9ce0c9b3bC60efFBD20ce5Ca2',
          tokenOut: '0x7B1B2b764373b3b8Ad576B1c91E10f16b2b7b0f3',
          amountIn: '1000000000000000000',
          minAmountOut: '990000000000000000',
          targetPrice: '1000000000000000000',
          direction: 'gte',
        },
      });
    jobIdA = res.body.job.id;
  });

  it('Owner B cannot access owner A job', async () => {
    const res = await request(app)
      .get(`/jobs/${jobIdA}`)
      .set('Authorization', authB);
    expect(res.status).toBe(403);
  });

  it('Owner B cannot cancel owner A job', async () => {
    const res = await request(app)
      .delete(`/jobs/${jobIdA}`)
      .set('Authorization', authB);
    expect(res.status).toBe(403);
  });
});
