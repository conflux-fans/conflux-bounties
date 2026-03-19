import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.unmock('./verification');

import { ethers } from 'ethers';
import {
    processVerificationJob,
    handleVerificationJob,
    onVerificationCompleted,
    onVerificationFailed,
    type VerificationDeps,
    type VerificationJobData
} from './verification';
import { mockPrisma } from '../test/mocks';

vi.mock('bullmq', () => {
    return {
        Queue: vi.fn(),
        Worker: class {
            on = vi.fn().mockReturnThis();
            close = vi.fn();
        }
    };
});

describe('verification', () => {
    const expectedHash = '0x' + 'a'.repeat(64);
    const mockBytecode = new Uint8Array(32);
    const bytecodeHex = ethers.hexlify(mockBytecode) as `0x${string}`;
    const computedHash = ethers.keccak256(bytecodeHex);

    let deps: VerificationDeps;
    let jobData: VerificationJobData;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.submission.update.mockResolvedValue({});
        deps = {
            prisma: mockPrisma as VerificationDeps['prisma'],
            getBytecode: vi.fn().mockResolvedValue(bytecodeHex),
            readContract: vi.fn().mockResolvedValue('0xowner'),
            verifyWithConfluxScan: vi.fn().mockResolvedValue({ success: true })
        };
        jobData = {
            submissionId: 'sub-1',
            contractAddress: '0x' + 'b'.repeat(40),
            cid: 'QmX',
            checksum: '0xab',
            signature: '0xsig',
            metadata: { bytecodeHash: computedHash }
        };
    });

    it('updates submission to VERIFIED when all checks pass', async () => {
        await processVerificationJob(deps, jobData);
        expect(deps.prisma.submission.update).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: {
                status: 'VERIFIED',
                verificationLog: expect.stringContaining('bytecode')
            }
        });
    });

    it('throws when no bytecode at address', async () => {
        deps.getBytecode = vi.fn().mockResolvedValue(undefined);
        await expect(processVerificationJob(deps, jobData)).rejects.toThrow(
            'No bytecode found at address'
        );
        expect(deps.prisma.submission.update).not.toHaveBeenCalled();
    });

    it('throws when bytecode hash mismatch', async () => {
        jobData.metadata.bytecodeHash = expectedHash;
        await expect(processVerificationJob(deps, jobData)).rejects.toThrow(
            'Bytecode hash mismatch'
        );
    });

    it('throws when ConfluxScan verification fails', async () => {
        deps.verifyWithConfluxScan = vi.fn().mockResolvedValue({
            success: false,
            message: 'Contract not verified'
        });
        await expect(processVerificationJob(deps, jobData)).rejects.toThrow(
            'Contract not verified'
        );
    });

    it('calls readContract for owner', async () => {
        await processVerificationJob(deps, jobData);
        expect(deps.readContract).toHaveBeenCalledWith(
            expect.objectContaining({
                functionName: 'owner'
            })
        );
    });

    it('throws when ConfluxScan returns success: false with no message', async () => {
        deps.verifyWithConfluxScan = vi.fn().mockResolvedValue({ success: false });
        await expect(processVerificationJob(deps, jobData)).rejects.toThrow(
            'ConfluxScan verification failed'
        );
    });
});

describe('handleVerificationJob', () => {
    const computedHash = ethers.keccak256(ethers.hexlify(new Uint8Array(32)) as `0x${string}`);
    const jobData: VerificationJobData = {
        submissionId: 'sub-fail',
        contractAddress: '0x' + 'b'.repeat(40),
        cid: 'QmX',
        checksum: '0xab',
        signature: '0xsig',
        metadata: { bytecodeHash: computedHash }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.submission.update.mockResolvedValue({});
    });

    it('updates submission to FAILED when processVerificationJob throws', async () => {
        const deps: VerificationDeps = {
            prisma: mockPrisma as VerificationDeps['prisma'],
            getBytecode: vi.fn().mockRejectedValue(new Error('Network error')),
            readContract: vi.fn(),
            verifyWithConfluxScan: vi.fn()
        };

        await handleVerificationJob(deps, { data: jobData, id: 'job-1' });

        expect(mockPrisma.submission.update).toHaveBeenCalledWith({
            where: { id: 'sub-fail' },
            data: {
                status: 'FAILED',
                failureReason: 'Network error'
            }
        });
    });

    it('updates submission to FAILED with bytecode mismatch message', async () => {
        const deps: VerificationDeps = {
            prisma: mockPrisma as VerificationDeps['prisma'],
            getBytecode: vi.fn().mockResolvedValue(ethers.hexlify(new Uint8Array(32)) as `0x${string}`),
            readContract: vi.fn(),
            verifyWithConfluxScan: vi.fn()
        };
        const wrongHashJob = {
            ...jobData,
            metadata: { bytecodeHash: '0x' + 'f'.repeat(64) }
        };

        await handleVerificationJob(deps, { data: wrongHashJob, id: 'job-2' });

        expect(mockPrisma.submission.update).toHaveBeenCalledWith({
            where: { id: 'sub-fail' },
            data: {
                status: 'FAILED',
                failureReason: expect.stringContaining('Bytecode hash mismatch')
            }
        });
    });
});

describe('onVerificationCompleted', () => {
    it('logs job id', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => { });
        onVerificationCompleted({ id: '123' });
        expect(log).toHaveBeenCalledWith('123 has completed!');
        log.mockRestore();
    });
});

describe('onVerificationFailed', () => {
    it('logs job id and error message', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => { });
        onVerificationFailed({ id: '456' }, new Error('Something broke'));
        expect(log).toHaveBeenCalledWith('456 has failed with Something broke');
        log.mockRestore();
    });

    it('handles undefined job', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => { });
        onVerificationFailed(undefined, new Error('No job'));
        expect(log).toHaveBeenCalledWith('undefined has failed with No job');
        log.mockRestore();
    });
});




describe('processVerificationJob skipBytecodeCheck', () => {
    it('skips bytecode hash check when placeholder is provided', async () => {
        const deps = {
            prisma: mockPrisma as any,
            getBytecode: vi.fn().mockResolvedValue('0x' + 'f'.repeat(64)), // mismatching bytecode
            readContract: vi.fn().mockResolvedValue('0xowner'),
            verifyWithConfluxScan: vi.fn().mockResolvedValue({ success: true })
        };
        const jobData = {
            submissionId: 'sub-1',
            contractAddress: '0xabc',
            cid: 'QmX',
            checksum: '0xab',
            signature: '0xsig',
            metadata: { bytecodeHash: '0x' + '0'.repeat(64) } // placeholder
        };

        await expect(processVerificationJob(deps, jobData)).resolves.not.toThrow();

        expect(deps.prisma.submission.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    verificationLog: expect.stringContaining('"skipped":true')
                })
            })
        );
    });
});

import { getConnection, getVerificationQueue, startWorker } from './verification';

describe('verification infrastructure', () => {
    it('getConnection returns an IORedis instance', () => {
        const conn = getConnection();
        expect(conn).toBeDefined();
    });

    it('getVerificationQueue returns a Queue instance', () => {
        const q = getVerificationQueue();
        expect(q).toBeDefined();
    });

    it('worker initialization', () => {
        const worker = startWorker();
        expect(worker).toBeDefined();
    });
});

