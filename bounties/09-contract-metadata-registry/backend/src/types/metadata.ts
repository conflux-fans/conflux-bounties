import { z } from "zod";

export const metadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  abi: z.array(z.any()).min(1),
  bytecodeHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  compiler: z.object({
    name: z.string(),
    version: z.string(),
    optimization: z.boolean().optional(),
    runs: z.number().optional(),
  }),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  social: z
    .object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      discord: z.string().optional(),
      telegram: z.string().optional(),
    })
    .optional(),
});

export type Metadata = z.infer<typeof metadataSchema>;

/** Submission request body */
export const submitRequestSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  metadata: metadataSchema,
});

export type SubmitRequest = z.infer<typeof submitRequestSchema>;

/** Admin action request body */
export const rejectRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
