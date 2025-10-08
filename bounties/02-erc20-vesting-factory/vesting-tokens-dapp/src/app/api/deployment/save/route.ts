// =================================================================
// 4. app/src/app/api/deployment/save/route.ts - SAVE DEPLOYMENT DATA
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import { users, deployedTokens, vestingSchedules } from "@/lib/drizzle/schema";

import { z } from "zod";

const saveDeploymentSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tokenConfig: z.object({
    name: z.string(),
    symbol: z.string(),
    totalSupply: z.string(),
    decimals: z.number().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
    logo: z.string().optional(),
  }),
  vestingSchedules: z.array(
    z.object({
      category: z.string(),
      cliffMonths: z.number(),
      vestingMonths: z.number(),
      revocable: z.boolean(),
      description: z.string().optional(),
    })
  ),
  beneficiaries: z.array(
    z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      category: z.string(),
      amount: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
    })
  ),
  vestingContracts: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = saveDeploymentSchema.parse(body);

    // ✅ WRAP ALL DATABASE OPERATIONS IN A TRANSACTION
    const result = await db.transaction(async (tx) => {
      // Create user if doesn't exist (upsert)
      await tx
        .insert(users)
        .values({ address: data.userAddress })
        .onConflictDoNothing({ target: users.address });

      // Save deployed token
      const [deployedToken] = await tx
        .insert(deployedTokens)
        .values({
          address: data.tokenAddress,
          name: data.tokenConfig.name,
          symbol: data.tokenConfig.symbol,
          totalSupply: data.tokenConfig.totalSupply,
          decimals: data.tokenConfig.decimals || 18,
          ownerAddress: data.userAddress,
          factoryTxHash: data.transactionHash,
          description: data.tokenConfig.description,
          website: data.tokenConfig.website,
          logo: data.tokenConfig.logo,
        })
        .returning();

      // Save vesting schedules
      for (let i = 0; i < data.beneficiaries.length; i++) {
        const beneficiary = data.beneficiaries[i];
        const schedule = data.vestingSchedules.find(
          (s) => s.category === beneficiary.category
        );

        // ✅ VALIDATE SCHEDULE EXISTS
        if (!schedule) {
          throw new Error(
            `No vesting schedule found for category: ${beneficiary.category}`
          );
        }

        // Create beneficiary user if doesn't exist
        await tx
          .insert(users)
          .values({
            address: beneficiary.address,
            name: beneficiary.name,
            email: beneficiary.email,
          })
          .onConflictDoNothing({ target: users.address });

        // ✅ VALIDATE VESTING CONTRACT INDEX
        if (i >= data.vestingContracts.length) {
          throw new Error(
            `Missing vesting contract for beneficiary at index ${i}`
          );
        }

        // Create vesting schedule
        await tx.insert(vestingSchedules).values({
          tokenId: deployedToken.id,
          contractAddress: data.vestingContracts[i],
          beneficiaryAddress: beneficiary.address,
          totalAmount: beneficiary.amount,
          cliffDuration: schedule.cliffMonths * 30 * 24 * 60 * 60, // Convert to seconds
          vestingDuration: schedule.vestingMonths * 30 * 24 * 60 * 60,
          startTime: new Date(),
          revocable: schedule.revocable,
          category: beneficiary.category,
          description: schedule.description,
        });
      }

      return { tokenId: deployedToken.id };
    });

    return NextResponse.json({
      success: true,
      message: "Deployment saved successfully",
      tokenId: result.tokenId,
    });
  } catch (error) {
    console.error("Save deployment error:", error);
    return NextResponse.json(
      {
        error: "Failed to save deployment data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
