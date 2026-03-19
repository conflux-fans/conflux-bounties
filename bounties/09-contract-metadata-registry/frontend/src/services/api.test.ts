import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getMetadataSearch,
  getMetadata,
  getSubmissions,
  getContractVersionHistory,
  prepareSubmission,
  finalizeSubmission,
  approveSubmission,
  rejectSubmission,
  uploadLogo,
} from './api';

describe('api client', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('getMetadataSearch', () => {
    it('builds search URL with q and tag', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
      await getMetadataSearch({ q: 'dex', tag: 'amm' });
      expect(mockFetch).toHaveBeenCalled();
      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toContain('/metadata/');
      expect(url.searchParams.get('q')).toBe('dex');
      expect(url.searchParams.get('tag')).toBe('amm');
    });

    it('builds search URL without params', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
      await getMetadataSearch({});
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws on search failure', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);
      await expect(getMetadataSearch({})).rejects.toThrow('Search failed');
    });
  });

  describe('uploadLogo', () => {
    it('uploads file and returns result', async () => {
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://ipfs.io/ipfs/QmX' }),
      } as Response);
      const result = await uploadLogo(file);
      expect(result).toEqual({ url: 'https://ipfs.io/ipfs/QmX' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/assets/logo'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('throws with server error message on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'File too large' }),
      } as Response);
      const file = new File(['x'], 'logo.png');
      await expect(uploadLogo(file)).rejects.toThrow('File too large');
    });

    it('throws generic message when json parse fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('invalid json');
        },
      } as unknown as Response);
      const file = new File(['x'], 'logo.png');
      await expect(uploadLogo(file)).rejects.toThrow('Logo upload failed');
    });
  });

  describe('getMetadata', () => {
    it('returns metadata for address', async () => {
      const data = { cid: 'QmX', checksum: '0xab', version: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => data,
      } as Response);
      const result = await getMetadata('0x' + 'a'.repeat(40));
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockFetch.mock.calls[0][0]).toMatch(/\/metadata\/0x[a-fA-F0-9]{40}$/);
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);
      const result = await getMetadata('0x' + 'a'.repeat(40));
      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
      await expect(getMetadata('0x' + 'a'.repeat(40))).rejects.toThrow('Fetch failed');
    });
  });

  describe('getSubmissions', () => {
    it('fetches with status filter', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
      await getSubmissions('PENDING,VERIFIED');
      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('status')).toBe('PENDING,VERIFIED');
    });

    it('fetches without status', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
      await getSubmissions();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);
      await expect(getSubmissions()).rejects.toThrow('Failed to load submissions');
    });
  });

  describe('getContractVersionHistory', () => {
    it('fetches with contractAddress', async () => {
      const data = [{ id: '1', version: 1 }];
      mockFetch.mockResolvedValue({ ok: true, json: async () => data } as Response);
      const result = await getContractVersionHistory('0x' + 'a'.repeat(40));
      expect(result).toEqual(data);
      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('contractAddress')).toBe('0x' + 'a'.repeat(40));
    });

    it('throws on error', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);
      await expect(getContractVersionHistory('0x' + 'a'.repeat(40))).rejects.toThrow(
        'Failed to load version history'
      );
    });
  });

  describe('prepareSubmission', () => {
    it('posts metadata and returns cid and checksum', async () => {
      const metadata = { name: 'Test', abi: [], bytecodeHash: '0x' + '0'.repeat(64), compiler: { version: '0.8.0' }, description: 'x' };
      const response = { cid: 'QmX', checksum: '0xab' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => response,
      } as Response);
      const result = await prepareSubmission(metadata);
      expect(result).toEqual(response);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/submissions/prepare'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata }),
        })
      );
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
      await expect(prepareSubmission({} as any)).rejects.toThrow('Preparation failed');
    });
  });

  describe('finalizeSubmission', () => {
    it('posts and returns success', async () => {
      const payload = {
        contractAddress: '0x' + 'a'.repeat(40),
        cid: 'QmX',
        checksum: '0xab',
        signature: '0x123',
        metadata: { abi: [], bytecodeHash: '0x' + '0'.repeat(64), compiler: { version: '0.8.0' }, description: 'x' },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, submissionId: 'sub-1' }),
      } as Response);
      const result = await finalizeSubmission(payload);
      expect(result.submissionId).toBe('sub-1');
    });

    it('throws with error message on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Checksum mismatch' }),
      } as Response);
      await expect(finalizeSubmission({} as any)).rejects.toThrow('Checksum mismatch');
    });

    it('throws generic message when server returns no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);
      await expect(finalizeSubmission({} as any)).rejects.toThrow('Finalization failed');
    });
  });

  describe('approveSubmission', () => {
    it('posts with options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'APPROVED' }),
      } as Response);
      await approveSubmission('sub-1', { txHash: '0xtx', version: 1, moderatorAddress: '0x' + 'a'.repeat(40) });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/submissions/sub-1/approve'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ txHash: '0xtx', version: 1, moderatorAddress: '0x' + 'a'.repeat(40) }),
        })
      );
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);
      await expect(approveSubmission('sub-1')).rejects.toThrow('Failed to approve submission');
    });
  });

  describe('rejectSubmission', () => {
    it('posts with reason and moderatorAddress', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
      await rejectSubmission('sub-1', 'Spam', '0x' + 'a'.repeat(40));
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/submissions/sub-1/reject'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Spam', moderatorAddress: '0x' + 'a'.repeat(40) }),
        })
      );
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);
      await expect(rejectSubmission('sub-1')).rejects.toThrow('Failed to reject submission');
    });
  });
});

