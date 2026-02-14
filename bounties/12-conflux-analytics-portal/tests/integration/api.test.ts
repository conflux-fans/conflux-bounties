/**
 * Integration tests for the API.
 * These require a running PostgreSQL and Redis instance.
 * Run with: pnpm test -- --testPathPattern=tests/integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('API Integration', () => {
  const BASE_URL = 'http://localhost:3001/api/v1';

  it('GET /health should return status ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('GET /activity/daily should return data array', async () => {
    const res = await fetch(`${BASE_URL}/activity/daily`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('GET /fees/daily should return data array', async () => {
    const res = await fetch(`${BASE_URL}/fees/daily`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('GET /contracts/top should support sort param', async () => {
    const res = await fetch(`${BASE_URL}/contracts/top?sort=gas_used&order=desc&limit=5`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('GET /tokens should return token list', async () => {
    const res = await fetch(`${BASE_URL}/tokens`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('GET /dapps/leaderboard should return leaderboard', async () => {
    const res = await fetch(`${BASE_URL}/dapps/leaderboard`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('GET /network/overview should return numeric fields', async () => {
    const res = await fetch(`${BASE_URL}/network/overview`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.latestBlock).toBe('number');
  });

  it('GET /transactions/stats should return success rate', async () => {
    const res = await fetch(`${BASE_URL}/transactions/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.successRate).toBe('number');
  });

  it('GET /export/activity?format=csv should return CSV', async () => {
    const res = await fetch(`${BASE_URL}/export/activity?format=csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('POST /shares should create a share and GET should retrieve it', async () => {
    const createRes = await fetch(`${BASE_URL}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { page: 'test' } }),
    });
    expect(createRes.status).toBe(201);
    const { slug } = await createRes.json();
    expect(typeof slug).toBe('string');

    const getRes = await fetch(`${BASE_URL}/shares/${slug}`);
    expect(getRes.status).toBe(200);
  });

  it('POST /webhooks should register a webhook', async () => {
    const res = await fetch(`${BASE_URL}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', eventType: 'daily_digest' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  it('should return 400 for invalid query params', async () => {
    const res = await fetch(`${BASE_URL}/activity/daily?limit=abc`);
    expect(res.status).toBe(400);
  });
});
