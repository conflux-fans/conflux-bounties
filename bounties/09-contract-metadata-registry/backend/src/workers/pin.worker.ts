import { Worker, Job } from "bullmq";
import { ethers } from "ethers";
import { redisConnection } from "../lib/queue";
import { db } from "../db/client";
import { submissions, ipfsPins } from "../db/schema";
import { ipfsService } from "../services/ipfs.service";
import { metadataSchema } from "../types/metadata";
import { eq } from "drizzle-orm";
import { env } from "../config/env";

interface PinJobData {
  submissionId: number;
  contractAddress: string;
  rawMetadata: unknown;
}

export function startPinWorker() {
  const worker = new Worker<PinJobData>(
    "pin",
    async (job: Job<PinJobData>) => {
      const { submissionId, contractAddress, rawMetadata } = job.data;

      // Validate schema
      const parsed = metadataSchema.safeParse(rawMetadata);
      if (!parsed.success) {
        await db
          .update(submissions)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(submissions.id, submissionId));
        throw new Error(`Schema validation failed: ${JSON.stringify(parsed.error.flatten())}`);
      }

      // Check size
      const jsonStr = JSON.stringify(parsed.data);
      if (Buffer.byteLength(jsonStr) > env.MAX_METADATA_KB * 1024) {
        await db
          .update(submissions)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(submissions.id, submissionId));
        throw new Error(`Metadata exceeds ${env.MAX_METADATA_KB}KB limit`);
      }

      // Update status to pinning
      await db
        .update(submissions)
        .set({ status: "pinning", updatedAt: new Date() })
        .where(eq(submissions.id, submissionId));

      // Pin to IPFS
      const pinResult = await ipfsService.pinJSON(parsed.data, `metadata-${contractAddress}`);

      // Compute content hash (keccak256 of canonical JSON)
      const canonicalJson = JSON.stringify(parsed.data, Object.keys(parsed.data).sort());
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

      // Update submission
      await db
        .update(submissions)
        .set({
          metadataCid: pinResult.IpfsHash,
          contentHash,
          status: "submitted_onchain",
          updatedAt: new Date(),
        })
        .where(eq(submissions.id, submissionId));

      // Record pin
      await db.insert(ipfsPins).values({
        cid: pinResult.IpfsHash,
        submissionId,
        provider: "pinata",
        pinStatus: "pinned",
        sizeBytes: pinResult.PinSize,
      });

      return { cid: pinResult.IpfsHash, contentHash };
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Pin job ${job?.id} failed:`, err.message);
  });

  return worker;
}
