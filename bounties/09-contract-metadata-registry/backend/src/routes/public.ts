import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const IPFS_GATEWAY = process.env.PINATA_GATEWAY || process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud';

export async function publicRoutes(fastify: FastifyInstance) {
    fastify.get<{ Params: { address: string } }>('/:address/full', async (request, reply) => {
        const { address } = request.params as { address: string };
        const ifNoneMatch = request.headers['if-none-match'];

        const latest = await prisma.submission.findFirst({
            where: {
                contractAddress: address,
                status: 'APPROVED'
            },
            orderBy: { version: 'desc' }
        });

        if (!latest) {
            return reply.status(404).send({ error: 'Metadata not found' });
        }

        const etag = `"${latest.checksum}"`;
        if (ifNoneMatch === etag) {
            return reply.status(304).send();
        }

        const gateway = IPFS_GATEWAY.replace(/\/$/, '');
        const url = `${gateway}/ipfs/${latest.cid}`;
        const res = await fetch(url);
        if (!res.ok) {
            return reply.status(502).send({ error: 'Failed to fetch metadata from IPFS' });
        }
        const metadata = await res.json();

        reply.header('Cache-Control', 'public, max-age=300, s-maxage=600');
        reply.header('ETag', etag);
        return reply.send({
            contractAddress: latest.contractAddress,
            version: latest.version,
            cid: latest.cid,
            checksum: latest.checksum,
            ...metadata
        });
    });

    fastify.get<{ Params: { address: string } }>('/:address', async (request, reply) => {
        const { address } = request.params;
        const ifNoneMatch = request.headers['if-none-match'];

        const latest = await prisma.submission.findFirst({
            where: {
                contractAddress: address,
                status: 'APPROVED'
            },
            orderBy: { version: 'desc' }
        });

        if (!latest) {
            return reply.status(404).send({ error: 'Metadata not found' });
        }

        const etag = `"${latest.checksum}"`;
        if (ifNoneMatch === etag) {
            return reply.status(304).send();
        }

        reply.header('Cache-Control', 'public, max-age=300');
        reply.header('ETag', etag);

        return reply.send({
            contractAddress: latest.contractAddress,
            version: latest.version,
            cid: latest.cid,
            checksum: latest.checksum,
            status: latest.status
        });
    });

    fastify.get('/', async (request, reply) => {
        const { tag, q } = request.query as { tag?: string; q?: string };

        const where: any = { status: 'APPROVED' };
        if (tag) {
            where.tagsJson = { contains: `"${tag}"` };
        }
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } }
            ];
        }

        const rows = await prisma.submission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        return reply.send(rows);
    });
}
