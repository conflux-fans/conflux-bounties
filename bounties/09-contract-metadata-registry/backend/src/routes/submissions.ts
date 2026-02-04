import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client";
import { submissions } from "../db/schema";
import { submitRequestSchema } from "../types/metadata";
import { validateBody } from "../middleware/validate";
import { siweAuth } from "../middleware/auth";
import { pinQueue, verifyQueue } from "../lib/queue";
import { eq, desc, and, ilike } from "drizzle-orm";

export async function submissionRoutes(app: FastifyInstance) {
  /** POST /api/submissions — Submit metadata (requires SIWE auth) */
  app.post(
    "/api/submissions",
    { preHandler: [siweAuth, validateBody(submitRequestSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        contractAddress: string;
        metadata: Record<string, unknown>;
      };
      const walletAddress = request.walletAddress!;

      // Check for duplicate pending submission
      const existing = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.contractAddress, body.contractAddress.toLowerCase()),
            eq(submissions.status, "pending")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send({
          error: "A pending submission already exists for this contract",
          submissionId: existing[0].id,
        });
      }

      // Count existing versions for this contract
      const prev = await db
        .select()
        .from(submissions)
        .where(eq(submissions.contractAddress, body.contractAddress.toLowerCase()))
        .orderBy(desc(submissions.version))
        .limit(1);

      const nextVersion = prev.length > 0 ? prev[0].version + 1 : 1;

      // Insert submission
      const [submission] = await db
        .insert(submissions)
        .values({
          contractAddress: body.contractAddress.toLowerCase(),
          submitterAddress: walletAddress,
          rawMetadata: body.metadata,
          version: nextVersion,
          status: "pending",
        })
        .returning();

      // Queue IPFS pinning job
      await pinQueue.add("pin-metadata", {
        submissionId: submission.id,
        contractAddress: body.contractAddress,
        rawMetadata: body.metadata,
      });

      // Queue verification job
      if (body.metadata.bytecodeHash) {
        await verifyQueue.add("verify-contract", {
          submissionId: submission.id,
          contractAddress: body.contractAddress,
          submitterAddress: walletAddress,
          bytecodeHash: body.metadata.bytecodeHash as string,
        });
      }

      return reply.status(201).send({
        id: submission.id,
        status: submission.status,
        version: submission.version,
      });
    }
  );

  /** GET /api/submissions/:id — Check submission status */
  app.get(
    "/api/submissions/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
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

      return submission;
    }
  );

  /** GET /api/submissions — List submissions with filters */
  app.get(
    "/api/submissions",
    async (
      request: FastifyRequest<{
        Querystring: { status?: string; contract?: string; page?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { status, contract, page = "1", limit = "20" } = request.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const conditions = [];
      if (status) conditions.push(eq(submissions.status, status as any));
      if (contract) conditions.push(ilike(submissions.contractAddress, `%${contract}%`));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(submissions)
        .where(where)
        .orderBy(desc(submissions.createdAt))
        .limit(parseInt(limit, 10))
        .offset(offset);

      return { data: results, page: parseInt(page, 10), limit: parseInt(limit, 10) };
    }
  );
}
