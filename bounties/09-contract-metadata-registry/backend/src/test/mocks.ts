import { vi } from 'vitest';

export const mockPrisma = {
    submission: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
            id: 'sub-1',
            contractAddress: '0x123',
            cid: 'QmX',
            checksum: '0xab',
            status: 'PENDING',
            submitter: 'unknown'
        }),
        update: vi.fn().mockResolvedValue({})
    },
    contract: {
        upsert: vi.fn().mockResolvedValue({})
    },
    moderationLog: {
        create: vi.fn().mockResolvedValue({})
    },
    ipfsPin: {
        upsert: vi.fn().mockResolvedValue({})
    }
};

export const mockRedis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1)
};

export const mockIpfsService = {
    pinMetadata: vi.fn().mockResolvedValue('QmTestCid123'),
    pinFile: vi.fn().mockResolvedValue('QmFileCid456')
};

export const mockVerificationQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' })
};
