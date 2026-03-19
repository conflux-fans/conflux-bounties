import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('webhook', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('does not call fetch when WEBHOOK_URL is not set', async () => {
        vi.stubEnv('WEBHOOK_URL', '');
        vi.resetModules();
        const { notifyMetadataApproved } = await import('./webhook');
        await notifyMetadataApproved({
            event: 'METADATA_APPROVED',
            contractAddress: '0xabc',
            version: 1,
            cid: 'QmX',
            checksum: '0xab',
            status: 'APPROVED',
            approvedAt: new Date().toISOString()
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('sends POST to WEBHOOK_URL when set', async () => {
        vi.stubEnv('WEBHOOK_URL', 'https://webhook.example.com/notify');
        vi.resetModules();
        const { notifyMetadataApproved } = await import('./webhook');
        await notifyMetadataApproved({
            event: 'METADATA_APPROVED',
            contractAddress: '0xabc',
            version: 2,
            cid: 'QmY',
            checksum: '0xcd',
            status: 'APPROVED',
            approvedAt: '2025-01-01T00:00:00.000Z'
        });
        expect(fetch).toHaveBeenCalledWith('https://webhook.example.com/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'METADATA_APPROVED',
                contractAddress: '0xabc',
                version: 2,
                cid: 'QmY',
                checksum: '0xcd',
                status: 'APPROVED',
                approvedAt: '2025-01-01T00:00:00.000Z'
            })
        });
    });

    it('does not throw when fetch fails', async () => {
        vi.stubEnv('WEBHOOK_URL', 'https://webhook.example.com/notify');
        vi.resetModules();
        const { notifyMetadataApproved } = await import('./webhook');
        (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
        await expect(notifyMetadataApproved({
            event: 'METADATA_APPROVED',
            contractAddress: '0x',
            version: 1,
            cid: 'Qm',
            checksum: '0x',
            status: 'APPROVED',
            approvedAt: new Date().toISOString()
        })).resolves.toBeUndefined();
    });
});
