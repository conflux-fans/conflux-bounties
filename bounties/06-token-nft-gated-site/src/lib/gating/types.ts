import { z } from "zod";

export const conditionSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("ERC20"),
      chainId: z.number().int(),
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      minBalance: z.string().regex(/^\d+$/),
      decimals: z.number().int().min(0).max(36).optional(),
    }),
    z.object({
      type: z.literal("ERC721"),
      chainId: z.number().int(),
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      tokenId: z.string().regex(/^\d+$/),
    }),
    z.object({
      type: z.literal("ERC1155"),
      chainId: z.number().int(),
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      tokenId: z.string().regex(/^\d+$/),
      minQuantity: z.string().regex(/^\d+$/),
    }),
  ],
);

export const rulesJsonSchema = z.object({
  conditions: z.array(conditionSchema).min(1),
});

export type TokenCondition = z.infer<typeof conditionSchema>;
export type RulesJson = z.infer<typeof rulesJsonSchema>;
