// =================================================================
// 1. app/src/app/api/tokens/route.ts - GET TOKENS
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import {
  deployedTokens,
  vestingSchedules,
  vestingClaims,
  users,
} from "@/lib/drizzle/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("owner");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query conditions
    let whereCondition = undefined;
    if (ownerAddress) {
      whereCondition = eq(deployedTokens.ownerAddress, ownerAddress);
    }

    // Get tokens with relations
    const tokens = await db.query.deployedTokens.findMany({
      where: whereCondition,
      with: {
        vestingSchedules: {
          with: {
            claims: true,
          },
        },
        owner: true,
      },
      orderBy: [desc(deployedTokens.deployedAt)],
      limit,
      offset,
    });

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(deployedTokens)
      .where(whereCondition);

    return NextResponse.json({
      tokens,
      total: totalResult.count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get tokens error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}
