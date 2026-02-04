import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/queue";
import { db } from "../db/client";
import { submissions } from "../db/schema";
import { verificationService } from "../services/verification.service";
import { eq } from "drizzle-orm";

interface VerifyJobData {
  submissionId: number;
  contractAddress: string;
  submitterAddress: string;
  bytecodeHash: string;
}

export function startVerifyWorker() {
  const worker = new Worker<VerifyJobData>(
    "verify",
    async (job: Job<VerifyJobData>) => {
      const { submissionId, contractAddress, submitterAddress, bytecodeHash } = job.data;

      // Update status
      await db
        .update(submissions)
        .set({ status: "validating", updatedAt: new Date() })
        .where(eq(submissions.id, submissionId));

      // Verify ownership
      const isOwner = await verificationService.verifyOwnership(contractAddress, submitterAddress);

      // Verify bytecode checksum
      const bytecodeValid = await verificationService.verifyBytecodeChecksum(
        contractAddress,
        bytecodeHash
      );

      return {
        ownershipVerified: isOwner,
        bytecodeVerified: bytecodeValid,
      };
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Verify job ${job?.id} failed:`, err.message);
  });

  return worker;
}
