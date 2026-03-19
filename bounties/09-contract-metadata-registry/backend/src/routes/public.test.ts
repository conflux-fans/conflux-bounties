import { describe, it, expect, vi, beforeEach } from 'vitest';
import buildApp from '../app';
import { mockPrisma } from '../test/mocks';

describe('public routes', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    describe('GET /v1/metadata/:address', () => {
        it('returns 404 when no approved metadata for address', async () => {
            mockPrisma.submission.findFirst.mockResolvedValue(null);
            const res = await app.inject({
                method: 'GET',
                url: '/v1/metadata/0x' + 'a'.repeat(40)
            });
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body).error).toBe('Metadata not found');
        });

        it('returns metadata when approved submission exists', async () => {
            const row = {
                contractAddress: '0x' + 'a'.repeat(40),
                version: 2,
                cid: 'QmX',
                checksum: '0xab',
                status: 'APPROVED'
            };
            mockPrisma.submission.findFirst.mockResolvedValue(row);

            const res = await app.inject({
                method: 'GET',
                url: '/v1/metadata/0x' + 'a'.repeat(40)
            });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.contractAddress).toBe(row.contractAddress);
            expect(body.version).toBe(2);
            expect(body.cid).toBe('QmX');
            expect(body.status).toBe('APPROVED');
            expect(res.headers['cache-control']).toBe('public, max-age=300');
            expect(res.headers['etag']).toContain(row.checksum);
        });

        it('returns 304 when If-None-Match matches ETag', async () => {
            const row = {
                contractAddress: '0x' + 'a'.repeat(40),
                version: 2,
                cid: 'QmX',
                checksum: '0xabcd1234',
                status: 'APPROVED'
            };
            mockPrisma.submission.findFirst.mockResolvedValue(row);
            const etag = `"${row.checksum}"`;

            const res = await app.inject({
                method: 'GET',
                url: '/v1/metadata/0x' + 'a'.repeat(40),
                headers: { 'if-none-match': etag }
            });
            expect(res.statusCode).toBe(304);
        });
    });

    describe('GET /v1/metadata/:address/full', () => {
        it('returns 404 when no approved metadata for address', async () => {
            mockPrisma.submission.findFirst.mockResolvedValue(null);
            const res = await app.inject({
                method: 'GET',
                url: '/v1/metadata/0x' + 'b'.repeat(40) + '/full'
            });
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body).error).toBe('Metadata not found');
        });

        it('returns full metadata with Cache-Control and ETag when found', async () => {
            const row = {
                contractAddress: '0x' + 'b'.repeat(40),
                version: 1,
                cid: 'QmFull',
                checksum: '0xef',
                status: 'APPROVED'
            };
            mockPrisma.submission.findFirst.mockResolvedValue(row);
            const originalFetch = globalThis.fetch;
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ name: 'Test', abi: [] })
            }) as typeof fetch;

            try {
                const res = await app.inject({
                    method: 'GET',
                    url: '/v1/metadata/0x' + 'b'.repeat(40) + '/full'
                });
                expect(res.statusCode).toBe(200);
                const body = JSON.parse(res.body);
                expect(body.contractAddress).toBe(row.contractAddress);
                expect(body.version).toBe(1);
                expect(body.cid).toBe(row.cid);
                expect(body.checksum).toBe(row.checksum);
                expect(body.name).toBe('Test');
                expect(body.abi).toEqual([]);
                expect(res.headers['cache-control']).toBe('public, max-age=300, s-maxage=600');
                expect(res.headers['etag']).toContain(row.checksum);
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it('returns 304 when If-None-Match matches ETag', async () => {
            const row = {
                contractAddress: '0x' + 'b'.repeat(40),
                version: 1,
                cid: 'QmFull',
                checksum: '0x1234abcd',
                status: 'APPROVED'
            };
            mockPrisma.submission.findFirst.mockResolvedValue(row);
            const etag = `"${row.checksum}"`;

            const res = await app.inject({
                method: 'GET',
                url: '/v1/metadata/0x' + 'b'.repeat(40) + '/full',
                headers: { 'if-none-match': etag }
            });
            expect(res.statusCode).toBe(304);
        });

        it('returns 502 when IPFS fetch fails', async () => {
            const row = {
                contractAddress: '0x' + 'b'.repeat(40),
                version: 1,
                cid: 'QmFail',
                checksum: '0xef',
                status: 'APPROVED'
            };
            mockPrisma.submission.findFirst.mockResolvedValue(row);
            const originalFetch = globalThis.fetch;
            globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as typeof fetch;

            try {
                const res = await app.inject({
                    method: 'GET',
                    url: '/v1/metadata/0x' + 'b'.repeat(40) + '/full'
                });
                expect(res.statusCode).toBe(502);
                expect(JSON.parse(res.body).error).toBe('Failed to fetch metadata from IPFS');
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });

    describe('GET /v1/metadata/', () => {
        it('returns list of approved submissions', async () => {
            mockPrisma.submission.findMany.mockResolvedValue([
                { id: '1', status: 'APPROVED', name: 'C1' }
            ]);
            const res = await app.inject({ method: 'GET', url: '/v1/metadata/' });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(Array.isArray(body)).toBe(true);
            expect(mockPrisma.submission.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { status: 'APPROVED' },
                    take: 20
                })
            );
        });

        it('filters by tag when query provided', async () => {
            await app.inject({ method: 'GET', url: '/v1/metadata/?tag=defi' });
            expect(mockPrisma.submission.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: 'APPROVED',
                        tagsJson: { contains: '"defi"' }
                    })
                })
            );
        });

        it('filters by search q when query provided', async () => {
            await app.inject({ method: 'GET', url: '/v1/metadata/?q=token' });
            expect(mockPrisma.submission.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: 'APPROVED',
                        OR: [
                            { name: { contains: 'token', mode: 'insensitive' } },
                            { description: { contains: 'token', mode: 'insensitive' } }
                        ]
                    })
                })
            );
        });
    });
});
