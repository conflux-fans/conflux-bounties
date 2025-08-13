// =================================================================
// 5. app/src/app/api/claim/save/route.ts - SAVE CLAIM DATA
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import { vestingSchedules, vestingClaims } from "@/lib/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const saveClaimSchema = z.object({
  vestingContractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  beneficiaryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountClaimed: z.string(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  blockNumber: z.number().optional(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = saveClaimSchema.parse(body);

    // Find the vesting schedule
    const vestingSchedule = await db.query.vestingSchedules.findFirst({
      where: and(
        eq(vestingSchedules.contractAddress, data.vestingContractAddress),
        eq(vestingSchedules.beneficiaryAddress, data.beneficiaryAddress)
      ),
    });

    if (!vestingSchedule) {
      return NextResponse.json(
        { error: "Vesting schedule not found" },
        { status: 404 }
      );
    }

    // Record the claim
    await db.insert(vestingClaims).values({
      vestingScheduleId: vestingSchedule.id,
      amountClaimed: data.amountClaimed,
      txHash: data.transactionHash,
      blockNumber: data.blockNumber,
      gasUsed: data.gasUsed,
      gasPrice: data.gasPrice,
    });

    // Update released amount
    const currentReleased = parseFloat(vestingSchedule.releasedAmount || "0");
    const newReleased = currentReleased + parseFloat(data.amountClaimed);

    await db
      .update(vestingSchedules)
      .set({ releasedAmount: newReleased.toString() })
      .where(eq(vestingSchedules.id, vestingSchedule.id));

    return NextResponse.json({
      success: true,
      message: "Claim recorded successfully",
    });
  } catch (error) {
    console.error("Save claim error:", error);
    return NextResponse.json(
      {
        error: "Failed to save claim data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
