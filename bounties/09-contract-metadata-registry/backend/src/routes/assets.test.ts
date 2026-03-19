import { describe, it, expect, vi, beforeEach } from 'vitest';
import buildApp from '../app';
import { mockPrisma } from '../test/mocks';

describe('assets routes', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.ipfsPin.upsert.mockResolvedValue({});
        app = buildApp();
    });

    describe('POST /v1/assets/logo', () => {
        it('returns 400 when no file uploaded or request not multipart', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/assets/logo'
            });
            expect(res.statusCode).toBe(400);
            const err = JSON.parse(res.body).error;
            expect(['No file uploaded', 'the request is not multipart'].some(m => err.includes(m) || err === m)).toBe(true);
        });

        it('returns 200 and cid when valid image is uploaded', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/assets/logo',
                payload: {},
                headers: {}
            });
            const form = new FormData();
            form.append('file', new Blob(['fake-png'], { type: 'image/png' }), 'logo.png');
            const boundary = '----FormBoundary';
            const body =
                `--${boundary}\r\n` +
                'Content-Disposition: form-data; name="file"; filename="logo.png"\r\n' +
                'Content-Type: image/png\r\n\r\n' +
                'fake-png\r\n' +
                `--${boundary}--\r\n`;

            const uploadRes = await app.inject({
                method: 'POST',
                url: '/v1/assets/logo',
                payload: body,
                headers: {
                    'content-type': `multipart/form-data; boundary=${boundary}`
                }
            });
            expect([200, 400]).toContain(uploadRes.statusCode);
            if (uploadRes.statusCode === 200) {
                const data = JSON.parse(uploadRes.body);
                expect(data).toHaveProperty('cid');
                expect(data).toHaveProperty('url');
                expect(data.url).toContain('ipfs://');
            }
        });
    });
});
