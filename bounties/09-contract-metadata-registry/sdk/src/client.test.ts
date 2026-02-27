import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfluxMetadataClient, type MetadataResponse } from './client';
import fetch from 'cross-fetch';

vi.mock('cross-fetch', () => ({
  default: vi.fn(),
}));

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

describe('ConfluxMetadataClient', () => {
  const baseUrl = 'http://example.com/v1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses default baseUrl when none provided', async () => {
    const client = new ConfluxMetadataClient();

    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          contractAddress: '0xabc',
          version: 1,
          cid: 'QmX',
          checksum: '0x1',
          status: 'APPROVED',
        } satisfies MetadataResponse),
    } as any);

    await client.getMetadata('0xabc');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/metadata/0xabc');
  });

  it('allows overriding baseUrl via options', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          contractAddress: '0xabc',
          version: 1,
          cid: 'QmX',
          checksum: '0x1',
          status: 'APPROVED',
        } satisfies MetadataResponse),
    } as any);

    await client.getMetadata('0xabc');

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/metadata/0xabc`);
  });

  it('returns null when API responds with 404', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: () => Promise.resolve({}),
    } as any);

    const result = await client.getMetadata('0xmissing');

    expect(result).toBeNull();
  });

  it('throws when API responds with non-OK status (not 404)', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: () => Promise.resolve({}),
    } as any);

    await expect(client.getMetadata('0xabc')).rejects.toThrow('Failed to fetch metadata (500)');
  });

  it('parses JSON body into MetadataResponse on success', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    const payload: MetadataResponse = {
      contractAddress: '0xabc',
      version: 2,
      cid: 'QmMeta',
      checksum: '0x1234',
      status: 'APPROVED',
      metadata: { name: 'Token', description: 'My token' },
    };

    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(payload),
    } as any);

    const result = await client.getMetadata('0xabc');

    expect(result).toEqual(payload);
  });
});

describe('ConfluxMetadataClient - getMetadataFull', () => {
  const baseUrl = 'http://example.com/v1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data and etag on success', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });
    const payload = { contractAddress: '0xabc', version: 1, cid: 'QmX', checksum: '0x1', status: 'APPROVED', name: 'Token' };

    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(payload),
      headers: { get: (key: string) => key === 'ETag' ? '"0xchecksum"' : null },
    } as any);

    const result = await client.getMetadataFull('0xabc');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('etag', '"0xchecksum"');
    expect((result as any).data).toEqual(payload);
  });

  it('returns null when API responds with 404', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 404,
      ok: false,
    } as any);

    const result = await client.getMetadataFull('0xmissing');
    expect(result).toBeNull();
  });

  it('returns notModified when API responds with 304', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 304,
      ok: false,
    } as any);

    const result = await client.getMetadataFull('0xabc', { etag: '"old-etag"' });
    expect(result).toEqual({ notModified: true });
  });

  it('throws when API responds with non-OK status (not 404/304)', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
    } as any);

    await expect(client.getMetadataFull('0xabc')).rejects.toThrow('Failed to fetch full metadata (500)');
  });

  it('sends If-None-Match header when etag is provided', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });

    fetchMock.mockResolvedValueOnce({
      status: 304,
      ok: false,
    } as any);

    await client.getMetadataFull('0xabc', { etag: '"my-etag"' });

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/metadata/0xabc/full`,
      { headers: { 'If-None-Match': '"my-etag"' } }
    );
  });

  it('sends empty headers when no etag provided', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });
    const payload = { contractAddress: '0xabc', version: 1, cid: 'QmX', checksum: '0x1', status: 'APPROVED' };

    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(payload),
      headers: { get: () => null },
    } as any);

    await client.getMetadataFull('0xabc');

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/metadata/0xabc/full`,
      { headers: {} }
    );
  });

  it('returns null etag when response has no ETag header', async () => {
    const client = new ConfluxMetadataClient({ baseUrl });
    const payload = { contractAddress: '0xabc', version: 1, cid: 'QmX', checksum: '0x1', status: 'APPROVED' };

    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(payload),
      headers: { get: () => null },
    } as any);

    const result = await client.getMetadataFull('0xabc');
    expect(result).toHaveProperty('etag', null);
  });
});

