// =================================================================
// 5. app/src/app/api/claim/save/route.ts - SAVE CLAIM DATA
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import { vestingSchedules, vestingClaims } from "@/lib/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { rateLimitPOST, getClientIdentifier } from "@/lib/api/rate-limit";
import { sanitizeString } from "@/lib/api/sanitize";

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
    // ✅ RATE LIMITING
    const identifier = getClientIdentifier(request);
    const rateLimitResult = rateLimitPOST(identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            "Retry-After": Math.ceil(
              (rateLimitResult.reset - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const data = saveClaimSchema.parse(body);

    // ✅ WRAP IN TRANSACTION WITH DUPLICATE HANDLING
    const result = await db.transaction(async (tx) => {
      // Find the vesting schedule
      const vestingSchedule = await tx.query.vestingSchedules.findFirst({
        where: and(
          eq(vestingSchedules.contractAddress, data.vestingContractAddress),
          eq(vestingSchedules.beneficiaryAddress, data.beneficiaryAddress)
        ),
      });

      if (!vestingSchedule) {
        throw new Error("Vesting schedule not found");
      }

      // ✅ CHECK FOR DUPLICATE CLAIM BY TX HASH
      const existingClaim = await tx.query.vestingClaims.findFirst({
        where: eq(vestingClaims.txHash, data.transactionHash),
      });

      if (existingClaim) {
        // Return success but indicate it was already recorded
        return {
          success: true,
          message: "Claim already recorded",
          duplicate: true,
          claimId: existingClaim.id,
        };
      }

      // Record the claim with upsert on conflict
      const [claim] = await tx
        .insert(vestingClaims)
        .values({
          vestingScheduleId: vestingSchedule.id,
          amountClaimed: data.amountClaimed,
          txHash: data.transactionHash,
          blockNumber: data.blockNumber,
          gasUsed: sanitizeString(data.gasUsed),
          gasPrice: sanitizeString(data.gasPrice),
        })
        .onConflictDoNothing({ target: vestingClaims.txHash })
        .returning();

      // If no claim was inserted (race condition), fetch existing
      if (!claim) {
        const existing = await tx.query.vestingClaims.findFirst({
          where: eq(vestingClaims.txHash, data.transactionHash),
        });
        return {
          success: true,
          message: "Claim already recorded",
          duplicate: true,
          claimId: existing?.id,
        };
      }

      // Update released amount
      const currentReleased = parseFloat(vestingSchedule.releasedAmount || "0");
      const newReleased = currentReleased + parseFloat(data.amountClaimed);

      await tx
        .update(vestingSchedules)
        .set({ releasedAmount: newReleased.toString() })
        .where(eq(vestingSchedules.id, vestingSchedule.id));

      return {
        success: true,
        message: "Claim recorded successfully",
        duplicate: false,
        claimId: claim.id,
      };
    });

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": rateLimitResult.reset.toString(),
      },
    });
  } catch (error) {
    console.error("Save claim error:", error);
    
    // Handle specific error types
    if (error instanceof Error && error.message === "Vesting schedule not found") {
      return NextResponse.json(
        { error: "Vesting schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to save claim data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
