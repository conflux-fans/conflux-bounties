// =================================================================
// 9. app/src/app/api/analytics/[tokenAddress]/route.ts - TOKEN ANALYTICS
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import {
  deployedTokens,
} from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenAddress: string } }
) {
  try {
    const { tokenAddress } = params;

    // Get token with all vesting data
    const token = await db.query.deployedTokens.findFirst({
      where: eq(deployedTokens.address, tokenAddress),
      with: {
        vestingSchedules: {
          with: {
            claims: true,
          },
        },
      },
    });

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Calculate analytics
    const totalAllocated = token.vestingSchedules.reduce(
      (sum, schedule) => sum + parseFloat(schedule.totalAmount),
      0
    );

    const totalClaimed = token.vestingSchedules.reduce(
      (sum, schedule) => sum + parseFloat(schedule.releasedAmount || "0"),
      0
    );

    const totalBeneficiaries = token.vestingSchedules.length;
    const activeBeneficiaries = token.vestingSchedules.filter(
      (s) => !s.revoked
    ).length;

    // Category breakdown
    const categoryStats = token.vestingSchedules.reduce((acc, schedule) => {
      const category = schedule.category || "uncategorized";
      if (!acc[category]) {
        acc[category] = {
          totalAmount: 0,
          claimedAmount: 0,
          beneficiaries: 0,
        };
      }
      acc[category].totalAmount += parseFloat(schedule.totalAmount);
      acc[category].claimedAmount += parseFloat(schedule.releasedAmount || "0");
      acc[category].beneficiaries += 1;
      return acc;
    }, {} as Record<string, { totalAmount: number; claimedAmount: number; beneficiaries: number }>);

    return NextResponse.json({
      token: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        totalSupply: token.totalSupply,
      },
      analytics: {
        totalAllocated,
        totalClaimed,
        totalBeneficiaries,
        activeBeneficiaries,
        percentageClaimed:
          totalAllocated > 0 ? (totalClaimed / totalAllocated) * 100 : 0,
        categoryStats,
      },
    });
  } catch (error) {
    console.error("Error fetching token analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch token analytics" },
      { status: 500 }
    );
  }
}
