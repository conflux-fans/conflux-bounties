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

