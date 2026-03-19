import { describe, it, expect, vi, beforeEach } from 'vitest';
import buildApp from '../app';
import { mockPrisma, mockRedis, mockVerificationQueue } from '../test/mocks';

const validMetadata = {
    name: 'Test Contract',
    abi: [{ type: 'function', name: 'foo', inputs: [] }],
    bytecodeHash: '0x' + 'a'.repeat(64),
    compiler: { version: '0.8.0', language: 'Solidity' as const },
    description: 'A test contract'
};

describe('submission routes', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('MODERATOR_WALLET', '');
        mockPrisma.submission.findMany.mockResolvedValue([]);
        mockPrisma.submission.findFirst.mockResolvedValue(null);
        mockPrisma.submission.findUnique.mockResolvedValue(null);
        mockPrisma.submission.create.mockResolvedValue({
            id: 'sub-1',
            contractAddress: '0x123',
            cid: 'QmX',
            checksum: '0xab',
            status: 'PENDING',
            submitter: 'unknown'
        });
        mockPrisma.submission.update.mockResolvedValue({});
        mockPrisma.contract.upsert.mockResolvedValue({});
        mockPrisma.moderationLog.create.mockResolvedValue({});
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);
        mockVerificationQueue.add.mockResolvedValue({ id: 'job-1' });
        app = buildApp();
    });

    describe('POST /v1/submissions/prepare', () => {
        it('returns cid and checksum for valid metadata', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body).toHaveProperty('cid');
            expect(body).toHaveProperty('checksum');
            expect(body.checksum).toMatch(/^0x[0-9a-fA-F]{64}$/);
        });

        it('returns 400 when metadata exceeds size limit', async () => {
            const hugeAbi = Array.from({ length: 3000 }, (_, i) => ({
                type: 'function',
                name: `f${i}`,
                inputs: []
            }));
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: {
                    metadata: { ...validMetadata, abi: hugeAbi }
                }
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain('50KB');
        });

        it('returns 400 when metadata validation fails', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: {
                    metadata: {
                        ...validMetadata,
                        bytecodeHash: 'invalid'
                    }
                }
            });
            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when body is missing metadata', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: {}
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /v1/submissions/finalize', () => {
        it('creates submission and returns submissionId', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'a'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    metadata: validMetadata
                }
            });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.success).toBe(true);
            expect(body.submissionId).toBe('sub-1');
            expect(mockPrisma.submission.create).toHaveBeenCalled();
            expect(mockVerificationQueue.add).toHaveBeenCalledWith(
                'verify-submission',
                expect.objectContaining({
                    contractAddress: '0x' + 'a'.repeat(40),
                    cid,
                    checksum
                })
            );
        });

        it('returns 400 on checksum mismatch', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'a'.repeat(40),
                    cid: 'QmX',
                    checksum: '0x' + 'f'.repeat(64),
                    signature: '0xsig',
                    metadata: validMetadata
                }
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain('Checksum');
        });

        it('returns 200 and "Already exists" when submission exists', async () => {
            mockPrisma.submission.findFirst.mockResolvedValueOnce({
                id: 'existing-id',
                contractAddress: '0x' + 'a'.repeat(40)
            });
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'a'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    metadata: validMetadata
                }
            });
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).message).toBe('Already exists');
            expect(JSON.parse(res.body).submissionId).toBe('existing-id');
            expect(mockPrisma.submission.create).not.toHaveBeenCalled();
        });

        it('returns 429 when submitter rate limit exceeded', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);
            mockRedis.incr.mockResolvedValue(11);

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'a'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    submitter: '0xsubmitter',
                    metadata: validMetadata
                }
            });
            expect(res.statusCode).toBe(429);
            expect(JSON.parse(res.body).error).toContain('Rate limit');
        });

        it('returns 400 when finalize metadata exceeds size limit', async () => {
            const hugeAbi = Array.from({ length: 10000 }, (_, i) => ({
                type: 'function',
                name: `f${i}`,
                inputs: []
            }));

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'b'.repeat(40),
                    cid: 'QmHuge',
                    checksum: '0x' + 'c'.repeat(64),
                    signature: '0xsig',
                    metadata: { ...validMetadata, abi: hugeAbi }
                }
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain('50KB');
        });

        it('applies submitter rate limiting window and allows first request', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);
            mockRedis.incr.mockResolvedValueOnce(1);

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'c'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    submitter: '0xsubmitter',
                    metadata: validMetadata
                }
            });

            expect(res.statusCode).toBe(200);
            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.stringContaining('rate:submitter:'),
                60
            );
        });

        it('finalize with submitter and current > 1 does not call expire for submitter key', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);
            mockRedis.incr.mockResolvedValueOnce(2).mockResolvedValueOnce(2);

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'e'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    submitter: '0xwallet',
                    metadata: validMetadata
                }
            });

            expect(res.statusCode).toBe(200);
            const expireCalls = mockRedis.expire.mock.calls;
            const submitterExpire = expireCalls.find((c: string[]) => c[0]?.includes('rate:submitter:'));
            expect(submitterExpire).toBeUndefined();
        });

        it('finalize with metadata tags sets tagsJson', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: { ...validMetadata, tags: ['nft', 'erc721'] } }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);

            await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'f'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    metadata: { ...validMetadata, tags: ['nft', 'erc721'] }
                }
            });

            expect(mockPrisma.submission.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    tagsJson: '["nft","erc721"]'
                })
            });
        });

        it('finalize without metadata name sets name to null', async () => {
            const metadataNoName = { ...validMetadata, name: undefined };
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: metadataNoName }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);

            await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + '1'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    metadata: metadataNoName
                }
            });

            expect(mockPrisma.submission.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: null
                })
            });
        });

        it('finalize catch returns Internal Error when error has no message', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);
            mockPrisma.submission.create.mockRejectedValueOnce({});

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + '9'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    metadata: validMetadata
                }
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe('Internal Error');
        });

        it('returns 400 when an internal error occurs during finalize', async () => {
            const prepareRes = await app.inject({
                method: 'POST',
                url: '/v1/submissions/prepare',
                payload: { metadata: validMetadata }
            });
            const { cid, checksum } = JSON.parse(prepareRes.body);

            mockPrisma.submission.create.mockRejectedValueOnce(new Error('DB error'));

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: '0x' + 'd'.repeat(40),
                    cid,
                    checksum,
                    signature: '0xsig',
                    metadata: validMetadata
                }
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain('DB error');
        });

        it('returns 400 for invalid contractAddress', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/finalize',
                payload: {
                    contractAddress: 'not-an-address',
                    cid: 'QmX',
                    checksum: '0x' + 'a'.repeat(64),
                    signature: '0xsig',
                    metadata: validMetadata
                }
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /v1/submissions/', () => {
        it('returns list of submissions', async () => {
            mockPrisma.submission.findMany.mockResolvedValue([
                { id: '1', status: 'PENDING', contractAddress: '0x1' }
            ]);
            const res = await app.inject({ method: 'GET', url: '/v1/submissions/' });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(Array.isArray(body)).toBe(true);
            expect(body).toHaveLength(1);
        });

        it('filters by status when query provided', async () => {
            await app.inject({ method: 'GET', url: '/v1/submissions/?status=APPROVED' });
            expect(mockPrisma.submission.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { status: 'APPROVED' }
                })
            );
        });

        it('filters by contractAddress for version history', async () => {
            const addr = '0x' + 'a'.repeat(40);
            mockPrisma.submission.findMany.mockResolvedValue([
                { id: '1', contractAddress: addr, version: 2, status: 'APPROVED', cid: 'Qm2', createdAt: new Date() },
                { id: '2', contractAddress: addr, version: 1, status: 'APPROVED', cid: 'Qm1', createdAt: new Date() }
            ]);
            const res = await app.inject({ method: 'GET', url: `/v1/submissions/?contractAddress=${addr}` });
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(Array.isArray(body)).toBe(true);
            expect(body).toHaveLength(2);
            expect(mockPrisma.submission.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { contractAddress: addr }
                })
            );
        });
    });

    describe('POST /v1/submissions/:id/approve', () => {
        it('returns 404 when submission not found', async () => {
            mockPrisma.submission.findUnique.mockResolvedValue(null);
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/nonexistent/approve',
                payload: {}
            });
            expect(res.statusCode).toBe(404);
        });

        it('approves submission and returns updated record', async () => {
            const submission = {
                id: 'sub-1',
                contractAddress: '0xabc',
                cid: 'QmX',
                checksum: '0xab',
                verificationLog: '{}'
            };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.findFirst.mockResolvedValue(null);
            mockPrisma.submission.update.mockResolvedValue({
                ...submission,
                status: 'APPROVED',
                version: 1
            });

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-1/approve',
                payload: { txHash: '0xtx' }
            });
            expect(res.statusCode).toBe(200);
            expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ action: 'APPROVE', target: 'sub-1', details: '{"txHash":"0xtx"}' })
            });
        });

        it('approves submission without txHash sets details to null', async () => {
            const submission = {
                id: 'sub-2',
                contractAddress: '0xdef',
                cid: 'QmY',
                checksum: '0xcd',
                verificationLog: '{}'
            };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.findFirst.mockResolvedValue(null);
            mockPrisma.submission.update.mockResolvedValue({ ...submission, status: 'APPROVED', version: 1 });

            await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-2/approve',
                payload: {}
            });

            expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ action: 'APPROVE', target: 'sub-2', details: null })
            });
        });

        it('returns 403 when MODERATOR_WALLET is set and moderatorAddress does not match', async () => {
            vi.stubEnv('MODERATOR_WALLET', '0x' + 'a'.repeat(40));
            const submission = {
                id: 'sub-1',
                contractAddress: '0xabc',
                cid: 'QmX',
                checksum: '0xab',
                verificationLog: '{}'
            };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.findFirst.mockResolvedValue(null);

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-1/approve',
                payload: { moderatorAddress: '0x' + 'b'.repeat(40) }
            });
            expect(res.statusCode).toBe(403);
            expect(JSON.parse(res.body).error).toContain('moderator');
            vi.stubEnv('MODERATOR_WALLET', '');
        });

        it('approves when MODERATOR_WALLET is set and moderatorAddress matches', async () => {
            const moderatorAddr = '0x' + 'a'.repeat(40);
            vi.stubEnv('MODERATOR_WALLET', moderatorAddr);
            const submission = {
                id: 'sub-1',
                contractAddress: '0xabc',
                cid: 'QmX',
                checksum: '0xab',
                verificationLog: '{}'
            };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.findFirst.mockResolvedValue(null);
            mockPrisma.submission.update.mockResolvedValue({ ...submission, status: 'APPROVED', version: 1 });

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-1/approve',
                payload: { moderatorAddress: moderatorAddr }
            });
            expect(res.statusCode).toBe(200);
            vi.stubEnv('MODERATOR_WALLET', '');
        });

        it('approves submission increments version from last approved', async () => {
            const submission = {
                id: 'sub-3',
                contractAddress: '0xghi',
                cid: 'QmZ',
                checksum: '0xef',
                verificationLog: '{}'
            };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.findFirst.mockResolvedValue({ ...submission, version: 2 });
            mockPrisma.submission.update.mockResolvedValue({ ...submission, status: 'APPROVED', version: 3 });

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-3/approve',
                payload: {}
            });
            expect(res.statusCode).toBe(200);
            expect(mockPrisma.submission.update).toHaveBeenCalledWith({
                where: { id: 'sub-3' },
                data: expect.objectContaining({ status: 'APPROVED', version: 3 })
            });
        });
    });

    describe('POST /v1/submissions/:id/reject', () => {
        it('returns 403 when MODERATOR_WALLET is set and moderatorAddress does not match', async () => {
            vi.stubEnv('MODERATOR_WALLET', '0x' + 'a'.repeat(40));
            mockPrisma.submission.findUnique.mockResolvedValue({
                id: 'sub-1',
                contractAddress: '0xabc',
                cid: 'QmX',
                checksum: '0xab'
            });

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-1/reject',
                payload: { reason: 'Spam', moderatorAddress: '0x' + 'b'.repeat(40) }
            });
            expect(res.statusCode).toBe(403);
            vi.stubEnv('MODERATOR_WALLET', '');
        });

        it('returns 404 when submission not found', async () => {
            mockPrisma.submission.findUnique.mockResolvedValue(null);
            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/nonexistent/reject',
                payload: {}
            });
            expect(res.statusCode).toBe(404);
        });

        it('rejects submission with reason', async () => {
            const submission = { id: 'sub-1', contractAddress: '0xabc' };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.update.mockResolvedValue({
                ...submission,
                status: 'REJECTED',
                failureReason: 'Spam'
            });

            const res = await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-1/reject',
                payload: { reason: 'Spam' }
            });
            expect(res.statusCode).toBe(200);
            expect(mockPrisma.submission.update).toHaveBeenCalledWith({
                where: { id: 'sub-1' },
                data: expect.objectContaining({
                    status: 'REJECTED',
                    failureReason: 'Spam'
                })
            });
        });

        it('rejects submission without reason uses default failureReason and null details', async () => {
            const submission = { id: 'sub-4', contractAddress: '0xjkl' };
            mockPrisma.submission.findUnique.mockResolvedValue(submission);
            mockPrisma.submission.update.mockResolvedValue({
                ...submission,
                status: 'REJECTED',
                failureReason: 'Rejected by moderator'
            });

            await app.inject({
                method: 'POST',
                url: '/v1/submissions/sub-4/reject',
                payload: {}
            });

            expect(mockPrisma.submission.update).toHaveBeenCalledWith({
                where: { id: 'sub-4' },
                data: expect.objectContaining({
                    status: 'REJECTED',
                    failureReason: 'Rejected by moderator'
                })
            });
            expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ action: 'REJECT', target: 'sub-4', details: null })
            });
        });
    });
});
