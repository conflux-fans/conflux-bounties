// =================================================================
// 3. app/src/app/api/user/[address]/route.ts - GET USER DATA
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import {
  users,
  deployedTokens,
  vestingSchedules,
  vestingClaims,
} from "@/lib/drizzle/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;

    const user = await db.query.users.findFirst({
      where: eq(users.address, address),
      with: {
        deployedTokens: {
          with: {
            vestingSchedules: {
              with: {
                claims: true,
              },
            },
          },
          orderBy: [desc(deployedTokens.deployedAt)],
        },
        vestingSchedules: {
          where: eq(vestingSchedules.beneficiaryAddress, address),
          with: {
            token: true,
            claims: {
              orderBy: [desc(vestingClaims.claimedAt)],
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate user statistics
    const stats = {
      tokensDeployed: user.deployedTokens.length,
      totalBeneficiaries: user.deployedTokens.reduce(
        (sum, token) => sum + token.vestingSchedules.length,
        0
      ),
      tokensReceiving: user.vestingSchedules.length,
      totalTokensVested: user.vestingSchedules.reduce(
        (sum, schedule) => sum + parseFloat(schedule.totalAmount),
        0
      ),
      totalTokensClaimed: user.vestingSchedules.reduce(
        (sum, schedule) => sum + parseFloat(schedule.releasedAmount || "0"),
        0
      ),
    };

    return NextResponse.json({
      user: {
        address: user.address,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      stats,
      deployedTokens: user.deployedTokens,
      vestingSchedules: user.vestingSchedules,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
