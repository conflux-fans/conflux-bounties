/**
 * E2E smoke test — verifies the full stack is running and connected.
 * Run after `docker compose up`.
 */

import { describe, it, expect } from '@jest/globals';

describe('E2E Smoke Tests', () => {
  it('API should be reachable', async () => {
    const res = await fetch('http://localhost:3001/api/v1/health');
    expect(res.ok).toBe(true);
  });

  it('Frontend should be reachable', async () => {
    const res = await fetch('http://localhost:5173/');
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain('Conflux Analytics');
  });

  it('API should return seeded activity data', async () => {
    const res = await fetch('http://localhost:3001/api/v1/activity/daily?limit=5');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('API should return seeded token data', async () => {
    const res = await fetch('http://localhost:3001/api/v1/tokens?limit=5');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('API should return seeded DApp data', async () => {
    const res = await fetch('http://localhost:3001/api/v1/dapps/leaderboard?limit=5');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data.length).toBeGreaterThan(0);
  });
});
