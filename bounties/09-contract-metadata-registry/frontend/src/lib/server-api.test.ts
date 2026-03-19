import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMetadataRecord, getFullMetadata } from './server-api';

describe('server-api', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('getMetadataRecord', () => {
    it('returns record when found', async () => {
      const data = { contractAddress: '0x' + 'a'.repeat(40), cid: 'QmX', checksum: '0xab', status: 'Approved' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => data,
      } as Response);
      const result = await getMetadataRecord('0x' + 'a'.repeat(40));
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/metadata\/0x[a-fA-F0-9]{40}$/),
        expect.any(Object)
      );
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);
      const result = await getMetadataRecord('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });

    it('returns null on non-404 error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
      const result = await getMetadataRecord('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await getMetadataRecord('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });
  });

  describe('getFullMetadata', () => {
    it('returns full metadata when found', async () => {
      const data = {
        contractAddress: '0x' + 'a'.repeat(40),
        cid: 'QmX',
        name: 'Test',
        abi: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => data,
      } as Response);
      const result = await getFullMetadata('0x' + 'a'.repeat(40));
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/metadata\/0x[a-fA-F0-9]{40}\/full$/),
        expect.any(Object)
      );
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);
      const result = await getFullMetadata('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });

    it('returns null on non-404 error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
      const result = await getFullMetadata('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await getFullMetadata('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });
  });
});
