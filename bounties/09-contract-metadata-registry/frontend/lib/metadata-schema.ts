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
  logoUrl: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
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
