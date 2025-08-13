// =================================================================
// 6. app/src/app/api/vesting/[address]/route.ts - GET VESTING SCHEDULES
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import { vestingSchedules, vestingClaims } from "@/lib/drizzle/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;

    const schedules = await db.query.vestingSchedules.findMany({
      where: eq(vestingSchedules.beneficiaryAddress, address),
      with: {
        token: true,
        claims: {
          orderBy: [desc(vestingClaims.claimedAt)],
        },
      },
      orderBy: [desc(vestingSchedules.createdAt)],
    });

    return NextResponse.json({
      schedules,
      total: schedules.length,
    });
  } catch (error) {
    console.error("Error fetching vesting schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch vesting schedules" },
      { status: 500 }
    );
  }
}
