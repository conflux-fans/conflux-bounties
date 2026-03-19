import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('confluxScan', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.stubEnv('CONFLUXSCAN_API_URL', 'https://api.confluxscan.io');
        vi.stubEnv('CONFLUXSCAN_API_KEY', 'test-key');
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        process.env.CONFLUXSCAN_API_URL = '';
        globalThis.fetch = originalFetch;
        vi.unstubAllEnvs();
    });

    it('returns success when CONFLUXSCAN_API_URL is not set', async () => {
        vi.stubEnv('CONFLUXSCAN_API_URL', '');
        vi.resetModules();
        const { verifyWithConfluxScan } = await import('./confluxScan');
        const result = await verifyWithConfluxScan('0x123');
        expect(result.success).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('returns success when API returns status success', async () => {
        vi.stubEnv('CONFLUXSCAN_API_URL', 'https://api.confluxscan.io');
        vi.stubEnv('CONFLUXSCAN_API_KEY', 'test-key');
        vi.resetModules();
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'success' })
        });
        const { verifyWithConfluxScan } = await import('./confluxScan');
        const result = await verifyWithConfluxScan('0xabc');
        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            'https://api.confluxscan.io/contract/info?address=0xabc',
            expect.objectContaining({
                headers: { Authorization: 'Bearer test-key' }
            })
        );
    });

    it('strips trailing slash from API URL', async () => {
        vi.stubEnv('CONFLUXSCAN_API_URL', 'https://api.example.com/');
        vi.resetModules();
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'success' })
        });
        const { verifyWithConfluxScan } = await import('./confluxScan');
        await verifyWithConfluxScan('0xaddr');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.example.com/contract/info?address=0xaddr',
            expect.any(Object)
        );
    });

    it('returns failure when HTTP response is not ok', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 404
        });
        const { verifyWithConfluxScan } = await import('./confluxScan');
        const result = await verifyWithConfluxScan('0xbad');
        expect(result.success).toBe(false);
        expect(result.message).toContain('404');
    });

    it('returns failure when API data status is not success', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'error' })
        });
        const { verifyWithConfluxScan } = await import('./confluxScan');
        const result = await verifyWithConfluxScan('0xaddr');
        expect(result.success).toBe(false);
        expect(result.message).toContain('Contract not verified');
    });

    it('returns failure and message on fetch throw', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
        const { verifyWithConfluxScan } = await import('./confluxScan');
        const result = await verifyWithConfluxScan('0xaddr');
        expect(result.success).toBe(false);
        expect(result.message).toContain('Network error');
    });

    it('calls without Authorization when API_KEY is not set', async () => {
        vi.stubEnv('CONFLUXSCAN_API_KEY', '');
        vi.resetModules();
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'success' })
        });
        const { verifyWithConfluxScan } = await import('./confluxScan');
        await verifyWithConfluxScan('0xaddr');
        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            { headers: undefined }
        );
    });
});
