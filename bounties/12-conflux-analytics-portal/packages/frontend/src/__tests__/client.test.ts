import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, apiPost } from '../api/client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns parsed JSON on a successful response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);

    const data = await apiFetch<{ status: string }>('/health');
    expect(data.status).toBe('ok');
  });

  it('throws the error message from the response body on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal error' }),
    } as Response);

    await expect(apiFetch('/health')).rejects.toThrow('internal error');
  });

  it('falls back to HTTP status when the error body has no message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);

    await expect(apiFetch('/health')).rejects.toThrow('API error: 503');
  });

  it('appends defined query params to the URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch('/activity/daily', { limit: 10, from: '2025-01-01', offset: undefined });
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('from=2025-01-01');
    expect(calledUrl).not.toContain('offset');
  });
});

describe('apiPost', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends a POST request and returns parsed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ slug: 'abc12345' }),
    } as Response);

    const data = await apiPost<{ slug: string }>('/shares', { config: { page: 'overview' } });
    expect(data.slug).toBe('abc12345');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('throws on a non-ok POST response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    } as Response);

    await expect(apiPost('/shares', {})).rejects.toThrow('bad request');
  });
});
