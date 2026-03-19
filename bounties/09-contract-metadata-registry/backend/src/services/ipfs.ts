import { PinataSDK } from 'pinata-web3';
import pinataSDK from '@pinata/sdk';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const pinataJson = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY || 'gateway.pinata.cloud',
});

const pinataFile = new pinataSDK({
    pinataJWTKey: process.env.PINATA_JWT
});

const prisma = new PrismaClient();

export class IpfsService {
    async pinMetadata(metadata: any): Promise<string> {
        try {
            const upload = await pinataJson.upload.json(metadata);
            const cid = upload.IpfsHash;

            await prisma.ipfsPin.upsert({
                where: { cid },
                update: {
                    provider: 'pinata',
                    status: 'PINNED',
                    attempts: { increment: 1 },
                    lastError: null
                },
                create: {
                    cid,
                    provider: 'pinata',
                    status: 'PINNED',
                    attempts: 1
                }
            });

            return cid;
        } catch (error: any) {
            console.error('Error pinning metadata to IPFS:', error);
            throw new Error('Failed to pin metadata');
        }
    }

    async pinFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
        try {
            const stream = Readable.from(buffer);
            const result = await pinataFile.pinFileToIPFS(stream, {
                pinataMetadata: { name: fileName },
                pinataOptions: { cidVersion: 1 }
            });
            const cid = result.IpfsHash;

            await prisma.ipfsPin.upsert({
                where: { cid },
                update: {
                    provider: 'pinata',
                    status: 'PINNED',
                    attempts: { increment: 1 },
                    lastError: null
                },
                create: {
                    cid,
                    provider: 'pinata',
                    status: 'PINNED',
                    attempts: 1
                }
            });

            return cid;
        } catch (error: any) {
            console.error('Error pinning file to IPFS:', error);
            throw new Error('Failed to pin file');
        }
    }
}
