import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpfsService } from './ipfs';
import { mockPrisma } from '../test/mocks';

describe('IpfsService', () => {
    let ipfs: IpfsService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.ipfsPin.upsert.mockResolvedValue({});
        ipfs = new IpfsService();
    });

    describe('pinMetadata', () => {
        it('returns cid and upserts ipfsPin', async () => {
            const metadata = { name: 'Test', description: 'Desc' };
            const cid = await ipfs.pinMetadata(metadata);
            expect(cid).toBe('QmMeta');
            expect(mockPrisma.ipfsPin.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { cid: 'QmMeta' },
                    update: expect.objectContaining({ status: 'PINNED' }),
                    create: expect.objectContaining({ cid: 'QmMeta', status: 'PINNED' })
                })
            );
        });

    });

    describe('pinFile', () => {
        it('returns cid and upserts ipfsPin', async () => {
            const buffer = Buffer.from('fake-png');
            const cid = await ipfs.pinFile(buffer, 'logo.png', 'image/png');
            expect(cid).toBe('QmFile');
            expect(mockPrisma.ipfsPin.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { cid: 'QmFile' },
                    create: expect.objectContaining({ cid: 'QmFile' })
                })
            );
        });

    });
});
