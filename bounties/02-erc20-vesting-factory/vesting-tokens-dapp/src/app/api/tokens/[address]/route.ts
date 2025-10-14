// =================================================================
// 2. app/src/app/api/tokens/[address]/route.ts - GET TOKEN BY ADDRESS
// =================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import { deployedTokens } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;

    const token = await db.query.deployedTokens.findFirst({
      where: eq(deployedTokens.address, address),
      with: {
        vestingSchedules: {
          with: {
            claims: true,
          },
        },
        owner: true,
      },
    });

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json(token);
  } catch (error) {
    console.error("Error fetching token:", error);
    return NextResponse.json(
      { error: "Failed to fetch token" },
      { status: 500 }
    );
  }
}
