import { z } from 'zod';

/** ABI entry */
const AbiItemSchema = z.object({
  type: z.string(),
  name: z.string().optional(),
  inputs: z.array(z.any()).optional(),
  outputs: z.array(z.any()).optional(),
  stateMutability: z.string().optional(),
});

/** Compiler */
const CompilerSchema = z.object({
  version: z.string().min(1),
  optimizerRuns: z.number().int().nonnegative().optional(),
  language: z.enum(['Solidity']).default('Solidity'),
});

/** Source ref (IPFS or URL) */
const SourceRefSchema = z.object({
  name: z.string(),
  ipfsCid: z.string().optional(),
  url: z.string().url().optional(),
});

/** Social links */
const SocialLinksSchema = z
  .object({
    twitter: z.string().url().optional(),
    discord: z.string().url().optional(),
    github: z.string().url().optional(),
    telegram: z.string().url().optional(),
  })
  .strict()
  .optional();

/** Metadata schema. ABI, bytecode hash, compiler, logo, description, tags. Size checked separately (<50KB). */
export const MetadataSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000),
    logo: z.string().url().optional(),
    logoUrl: z.string().url().optional(), // alias for logo
    website: z.string().url().optional(),
    tags: z.array(z.string().min(1).max(32)).max(16).optional(),
    abi: z.array(AbiItemSchema),
    bytecodeHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    compiler: CompilerSchema,
    sources: z.array(SourceRefSchema).optional(),
    socials: SocialLinksSchema,
  })
  .strict();

export type Metadata = z.infer<typeof MetadataSchema>;

/** Max metadata size, 50KB */
export const DEFAULT_MAX_METADATA_BYTES = 50 * 1024;

export const SubmissionRequestSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  metadata: MetadataSchema,
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

export type SubmissionRequest = z.infer<typeof SubmissionRequestSchema>;
