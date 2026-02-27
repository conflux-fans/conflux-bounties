import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { createPublicClient, http } from 'viem';
import { confluxESpaceTestnet } from 'viem/chains';
import { ethers } from 'ethers';
import { verifyWithConfluxScan } from './confluxScan';

const prisma = new PrismaClient();

let connection: IORedis | null = null;
export function getConnection(): IORedis {
    if (!connection) {
        connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null
        });
    }
    return connection;
}

let queue: Queue | null = null;
export function getVerificationQueue(): Queue {
    if (!queue) {
        queue = new Queue('verification', { connection: getConnection() as any });
    }
    return queue;
}

export { getVerificationQueue as _getQueue };

const client = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http()
});

export interface VerificationJobData {
    submissionId: string;
    contractAddress: string;
    cid: string;
    checksum: string;
    signature: string;
    metadata: { bytecodeHash: string };
}

export interface VerificationDeps {
    prisma: Pick<PrismaClient, 'submission'>;
    getBytecode: (opts: { address: `0x${string}` }) => Promise<`0x${string}` | undefined>;
    readContract: (opts: { address: `0x${string}`; abi: any[]; functionName: string }) => Promise<unknown>;
    verifyWithConfluxScan: (address: string) => Promise<{ success: boolean; message?: string }>;
}

export async function processVerificationJob(
    deps: VerificationDeps,
    jobData: VerificationJobData
): Promise<void> {
    const { submissionId, contractAddress, metadata } = jobData;
    const log: Array<Record<string, unknown>> = [];

    const bytecode = await deps.getBytecode({ address: contractAddress as `0x${string}` });
    if (!bytecode) throw new Error('No bytecode found at address');

    const runtimeHash = ethers.keccak256(bytecode);
    const placeholderBytecodeHash = '0x' + '0'.repeat(64);
    const skipBytecodeCheck = metadata.bytecodeHash === placeholderBytecodeHash;
    log.push({ step: 'bytecode', expected: metadata.bytecodeHash, actual: runtimeHash, skipped: skipBytecodeCheck });

    if (!skipBytecodeCheck && runtimeHash !== metadata.bytecodeHash) {
        throw new Error(`Bytecode hash mismatch. Expected ${metadata.bytecodeHash}, got ${runtimeHash}`);
    }

    const owner = await deps.readContract({
        address: contractAddress as `0x${string}`,
        abi: [{ type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }] }],
        functionName: 'owner'
    }) as string;
    log.push({ step: 'ownership', owner });

    const scanResult = await deps.verifyWithConfluxScan(contractAddress);
    log.push({ step: 'confluxscan', success: scanResult.success, message: scanResult.message });
    if (!scanResult.success) {
        throw new Error(scanResult.message || 'ConfluxScan verification failed');
    }

    await deps.prisma.submission.update({
        where: { id: submissionId },
        data: {
            status: 'VERIFIED',
            verificationLog: JSON.stringify(log)
        }
    });
}

export const defaultVerificationDeps: VerificationDeps = {
    prisma,
    getBytecode: client.getBytecode.bind(client),
    readContract: client.readContract.bind(client),
    verifyWithConfluxScan
};

export async function handleVerificationJob(
    deps: VerificationDeps,
    job: { data: VerificationJobData; id?: string }
): Promise<void> {
    const jobData = job.data;
    console.log(`Processing verification for ${jobData.submissionId}`);
    try {
        await processVerificationJob(deps, jobData);
        console.log(`Submission ${jobData.submissionId} VERIFIED`);
    } catch (err: any) {
        console.error(`Verification failed for ${jobData.submissionId}:`, err);
        await deps.prisma.submission.update({
            where: { id: jobData.submissionId },
            data: {
                status: 'FAILED',
                failureReason: err.message
            }
        });
    }
}

export function onVerificationCompleted(job: { id?: string }): void {
    console.log(`${job.id} has completed!`);
}

export function onVerificationFailed(job: { id?: string } | undefined, err: Error): void {
    console.log(`${job?.id} has failed with ${err.message}`);
}

/**
 * Start the BullMQ worker. Call this ONLY in long-lived server mode (server.ts),
 * NOT in Vercel serverless handlers.
 */
export function startWorker(): Worker {
    const worker = new Worker(
        'verification',
        job => handleVerificationJob(defaultVerificationDeps, job),
        { connection: getConnection() as any }
    );
    worker.on('completed', onVerificationCompleted);
    worker.on('failed', onVerificationFailed);
    return worker;
}
