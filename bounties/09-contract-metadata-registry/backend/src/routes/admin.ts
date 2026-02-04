import { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { submissions, moderationLogs, ipfsPins } from "../db/schema";
import { siweAuth, moderatorGuard } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { rejectRequestSchema } from "../types/metadata";
import { webhookService } from "../services/webhook.service";
import { ipfsService } from "../services/ipfs.service";
import { eq } from "drizzle-orm";
import { env } from "../config/env";

export async function adminRoutes(app: FastifyInstance) {
  const authHandlers = [siweAuth, moderatorGuard(env.MODERATOR_ADDRESSES)] as const;

  /** POST /api/admin/approve/:id */
  app.post<{ Params: { id: string } }>(
    "/api/admin/approve/:id",
    { preHandler: authHandlers as any },
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid submission ID" });
      }

      const [submission] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, id))
        .limit(1);

      if (!submission) {
        return reply.status(404).send({ error: "Submission not found" });
      }

      if (submission.status !== "submitted_onchain" && submission.status !== "pending") {
        return reply
          .status(400)
          .send({ error: `Cannot approve submission with status: ${submission.status}` });
      }

      await db
        .update(submissions)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(submissions.id, id));

      await db.insert(moderationLogs).values({
        submissionId: id,
        action: "approved",
        moderatorAddress: request.walletAddress!,
      });

      if (submission.metadataCid) {
        await webhookService.notifyApproval(
          submission.contractAddress,
          submission.metadataCid
        );
      }

      return { id, status: "approved" };
    }
  );

  /** POST /api/admin/reject/:id */
  app.post<{ Params: { id: string } }>(
    "/api/admin/reject/:id",
    { preHandler: [...authHandlers, validateBody(rejectRequestSchema)] as any },
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const { reason } = request.body as { reason: string };

      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid submission ID" });
      }

      const [submission] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, id))
        .limit(1);

      if (!submission) {
        return reply.status(404).send({ error: "Submission not found" });
      }

      if (submission.status !== "submitted_onchain" && submission.status !== "pending") {
        return reply
          .status(400)
          .send({ error: `Cannot reject submission with status: ${submission.status}` });
      }

      await db
        .update(submissions)
        .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
        .where(eq(submissions.id, id));

      await db.insert(moderationLogs).values({
        submissionId: id,
        action: "rejected",
        moderatorAddress: request.walletAddress!,
        reason,
      });

      if (submission.metadataCid) {
        try {
          await ipfsService.unpin(submission.metadataCid);
          await db
            .update(ipfsPins)
            .set({ pinStatus: "unpinned" })
            .where(eq(ipfsPins.cid, submission.metadataCid));
        } catch (err) {
          app.log.error({ err, cid: submission.metadataCid }, "Failed to unpin on rejection");
        }
      }

      return { id, status: "rejected", reason };
    }
  );
}
