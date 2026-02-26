import dotenv from 'dotenv';
import { vi } from 'vitest';
import { mockPrisma, mockRedis, mockVerificationQueue } from './mocks';

dotenv.config();

process.env.PINATA_JWT = process.env.PINATA_JWT || 'test-jwt';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn().mockImplementation(function (this: any) {
        return mockPrisma;
    })
}));

vi.mock('ioredis', () => ({
    default: vi.fn().mockImplementation(function (this: any) {
        return mockRedis;
    })
}));

vi.mock('pinata-web3', () => ({
    PinataSDK: vi.fn().mockImplementation(function (this: any) {
        return {
            upload: { json: vi.fn().mockResolvedValue({ IpfsHash: 'QmMeta' }) }
        };
    })
}));
vi.mock('@pinata/sdk', () => ({
    default: vi.fn().mockImplementation(function (this: any) {
        return {
            pinFileToIPFS: vi.fn().mockResolvedValue({ IpfsHash: 'QmFile' })
        };
    })
}));

vi.mock('../services/verification', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/verification')>();
    return {
        ...actual,
        getVerificationQueue: () => mockVerificationQueue,
        startWorker: vi.fn()
    };
});
