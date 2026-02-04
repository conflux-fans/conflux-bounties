import { FastifyReply, FastifyRequest } from "fastify";
import { ZodSchema, ZodError } from "zod";

/**
 * Creates a Fastify preHandler that validates request body against a Zod schema.
 */
export function validateBody(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.body = schema.parse(request.body);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          error: "Validation failed",
          details: err.flatten().fieldErrors,
        });
      }
      throw err;
    }
  };
}
