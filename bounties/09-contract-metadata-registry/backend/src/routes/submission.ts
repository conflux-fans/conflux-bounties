import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { MetadataSchema, DEFAULT_MAX_METADATA_BYTES } from '@conflux-metadata/shared';
import { IpfsService } from '../services/ipfs';
import { getVerificationQueue } from '../services/verification';
import { notifyMetadataApproved } from '../services/webhook';
import { ethers } from 'ethers';
import IORedis from 'ioredis';

const prisma = new PrismaClient();
const ipfs = new IpfsService();
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true
});

/** Max metadata size, 50KB default. Override with MAX_METADATA_KB. */
const MAX_METADATA_BYTES = process.env.MAX_METADATA_KB
    ? parseInt(process.env.MAX_METADATA_KB, 10) * 1024
    : DEFAULT_MAX_METADATA_BYTES;

function stableStringify(value: any): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    const keys = Object.keys(value).sort();
    const props = keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k]));
    return '{' + props.join(',') + '}';
}

const PrepareSubmissionBody = z.object({
    metadata: MetadataSchema
});

const FinalizeSubmissionBody = z.object({
    contractAddress: z.string(),
    cid: z.string(),
    checksum: z.string(),
    signature: z.string(),
    submitter: z.string().optional(),
    metadata: MetadataSchema,
    /** Force new submission even when contract+CID already exists */
    forceNew: z.boolean().optional()
});

export async function submissionRoutes(fastify: FastifyInstance) {
    fastify.post('/prepare', async (request, reply) => {
        try {
            const body = PrepareSubmissionBody.parse(request.body);

            const canonical = stableStringify(body.metadata);
            const byteLength = Buffer.byteLength(canonical, 'utf8');
            if (byteLength > MAX_METADATA_BYTES) {
                return reply.status(400).send({ error: 'Metadata JSON exceeds 50KB limit' });
            }

            const checksum = ethers.keccak256(ethers.toUtf8Bytes(canonical));
            const cid = await ipfs.pinMetadata(body.metadata);

            return reply.send({ cid, checksum });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/finalize', async (request, reply) => {
        try {
            const body = FinalizeSubmissionBody.parse(request.body);

            const canonical = stableStringify(body.metadata);
            const byteLength = Buffer.byteLength(canonical, 'utf8');
            if (byteLength > MAX_METADATA_BYTES) {
                return reply.status(400).send({ error: 'Metadata JSON exceeds 50KB limit' });
            }

            const computedChecksum = ethers.keccak256(ethers.toUtf8Bytes(canonical));
            if (computedChecksum !== body.checksum) {
                return reply.status(400).send({ error: 'Checksum mismatch' });
            }

            const existing = await prisma.submission.findFirst({
                where: { cid: body.cid, contractAddress: body.contractAddress }
            });

            if (existing && !body.forceNew) {
                return reply.send({ success: true, submissionId: existing.id, message: 'Already exists' });
            }

            const maxPerMinute = parseInt(process.env.MAX_SUBMISSIONS_PER_WALLET_PER_MIN || '10', 10);
            const ip = (request as any).ip || request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown';
            const ipKey = `rate:ip:${String(ip).replace(/[^a-fA-F0-9.:]/g, '_')}`;
            const ipCount = await redis.incr(ipKey);
            if (ipCount === 1) await redis.expire(ipKey, 60);
            if (ipCount > maxPerMinute) {
                return reply.status(429).send({ error: 'Rate limit exceeded for this IP' });
            }
            if (body.submitter) {
                const key = `rate:submitter:${body.submitter.toLowerCase()}`;
                const current = await redis.incr(key);
                if (current === 1) await redis.expire(key, 60);
                if (current > maxPerMinute) {
                    return reply.status(429).send({ error: 'Rate limit exceeded for this wallet' });
                }
            }

            await prisma.contract.upsert({
                where: { address: body.contractAddress },
                update: {},
                create: {
                    address: body.contractAddress
                }
            });

            const submission = await prisma.submission.create({
                data: {
                    contractAddress: body.contractAddress,
                    cid: body.cid,
                    checksum: body.checksum,
                    submitter: body.submitter ?? 'unknown',
                    status: 'PENDING',
                    verificationLog: JSON.stringify({ signature: body.signature }),
                    name: body.metadata.name ?? null,
                    description: body.metadata.description,
                    tagsJson: body.metadata.tags ? JSON.stringify(body.metadata.tags) : null
                }
            });

            await getVerificationQueue().add('verify-submission', {
                submissionId: submission.id,
                contractAddress: body.contractAddress,
                cid: body.cid,
                checksum: body.checksum,
                signature: body.signature,
                metadata: body.metadata
            });

            return reply.send({ success: true, submissionId: submission.id });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message || 'Internal Error' });
        }
    });

    fastify.get('/', async (request, reply) => {
        const statusParam = (request.query as any).status as string | undefined;
        const contractAddressParam = (request.query as any).contractAddress as string | undefined;

        const where: { status?: string | { in: string[] }; contractAddress?: string } = {};
        if (statusParam) {
            const statuses = statusParam.split(',').map((s: string) => s.trim()).filter(Boolean);
            where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
        }
        if (contractAddressParam && /^0x[a-fA-F0-9]{40}$/.test(contractAddressParam)) {
            where.contractAddress = contractAddressParam;
        }

        const submissions = await prisma.submission.findMany({
            where: Object.keys(where).length ? where : undefined,
            orderBy: contractAddressParam
                ? [{ version: 'desc' }, { createdAt: 'desc' }]
                : { createdAt: 'desc' },
            take: 50
        });

        return reply.send(submissions);
    });

    fastify.post('/:id/approve', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { txHash, version: bodyVersion, moderatorAddress } = (request.body as any) ?? {};

        const moderatorWallet = process.env.MODERATOR_WALLET?.trim().toLowerCase();
        if (moderatorWallet && moderatorWallet !== '0x0000000000000000000000000000000000000000') {
            const caller = String(moderatorAddress ?? '').trim().toLowerCase();
            if (!caller || caller !== moderatorWallet) {
                return reply.status(403).send({ error: 'Only the configured moderator wallet can approve submissions' });
            }
        }

        const submission = await prisma.submission.findUnique({ where: { id } });
        if (!submission) {
            return reply.status(404).send({ error: 'Submission not found' });
        }

        let nextVersion: number;
        if (bodyVersion != null && Number.isInteger(bodyVersion)) {
            nextVersion = Number(bodyVersion);
        } else {
            const lastApproved = await prisma.submission.findFirst({
                where: { contractAddress: submission.contractAddress, status: 'APPROVED' },
                orderBy: { version: 'desc' }
            });
            nextVersion = (lastApproved?.version ?? 0) + 1;
        }

        const updated = await prisma.submission.update({
            where: { id },
            data: {
                status: 'APPROVED',
                version: nextVersion,
                verificationLog: submission.verificationLog,
                failureReason: null
            }
        });

        await prisma.moderationLog.create({
            data: {
                actor: moderatorAddress ?? moderatorWallet ?? 'moderator',
                action: 'APPROVE',
                target: id,
                details: txHash ? JSON.stringify({ txHash }) : null
            }
        });

        void notifyMetadataApproved({
            event: 'METADATA_APPROVED',
            contractAddress: submission.contractAddress,
            version: nextVersion,
            cid: submission.cid,
            checksum: submission.checksum,
            status: 'APPROVED',
            approvedAt: new Date().toISOString()
        });

        return reply.send(updated);
    });

    fastify.post('/:id/reject', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { reason, moderatorAddress } = (request.body as any) ?? {};

        const moderatorWallet = process.env.MODERATOR_WALLET?.trim().toLowerCase();
        if (moderatorWallet && moderatorWallet !== '0x0000000000000000000000000000000000000000') {
            const caller = String(moderatorAddress ?? '').trim().toLowerCase();
            if (!caller || caller !== moderatorWallet) {
                return reply.status(403).send({ error: 'Only the configured moderator wallet can reject submissions' });
            }
        }

        const submission = await prisma.submission.findUnique({ where: { id } });
        if (!submission) {
            return reply.status(404).send({ error: 'Submission not found' });
        }

        const updated = await prisma.submission.update({
            where: { id },
            data: {
                status: 'REJECTED',
                failureReason: reason ?? 'Rejected by moderator'
            }
        });

        await prisma.moderationLog.create({
            data: {
                actor: moderatorAddress ?? moderatorWallet ?? 'moderator',
                action: 'REJECT',
                target: id,
                details: reason ?? null
            }
        });

        return reply.send(updated);
    });
}
