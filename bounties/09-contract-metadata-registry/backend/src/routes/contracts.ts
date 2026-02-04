import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client";
import { submissions } from "../db/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";

export async function contractRoutes(app: FastifyInstance) {
  /** GET /api/contracts/:address — Get latest approved metadata for a contract */
  app.get(
    "/api/contracts/:address",
    async (
      request: FastifyRequest<{ Params: { address: string } }>,
      reply: FastifyReply
    ) => {
      const address = request.params.address.toLowerCase();

      const [result] = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.contractAddress, address),
            eq(submissions.status, "approved")
          )
        )
        .orderBy(desc(submissions.version))
        .limit(1);

      if (!result) {
        return reply.status(404).send({ error: "No approved metadata found" });
      }

      // Cache for 5 minutes
      reply.header("Cache-Control", "public, max-age=300");

      return {
        contractAddress: result.contractAddress,
        metadata: result.rawMetadata,
        metadataCid: result.metadataCid,
        contentHash: result.contentHash,
        version: result.version,
        updatedAt: result.updatedAt,
      };
    }
  );

  /** GET /api/contracts — Search/browse approved contracts */
  app.get(
    "/api/contracts",
    async (
      request: FastifyRequest<{
        Querystring: { q?: string; tags?: string; page?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { q, tags, page = "1", limit = "20" } = request.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const conditions = [eq(submissions.status, "approved")];

      if (q) {
        conditions.push(ilike(submissions.contractAddress, `%${q}%`));
      }

      if (tags) {
        // Filter by tags in jsonb rawMetadata
        const tagList = tags.split(",").map((t) => t.trim());
        conditions.push(
          sql`${submissions.rawMetadata}->'tags' ?| array[${sql.join(
            tagList.map((t) => sql`${t}`),
            sql`, `
          )}]`
        );
      }

      const results = await db
        .select()
        .from(submissions)
        .where(and(...conditions))
        .orderBy(desc(submissions.updatedAt))
        .limit(parseInt(limit, 10))
        .offset(offset);

      const mapped = results.map((r) => ({
        contractAddress: r.contractAddress,
        metadata: r.rawMetadata,
        metadataCid: r.metadataCid,
        version: r.version,
        updatedAt: r.updatedAt,
      }));

      reply.header("Cache-Control", "public, max-age=60");

      return { data: mapped, page: parseInt(page, 10), limit: parseInt(limit, 10) };
    }
  );
}
