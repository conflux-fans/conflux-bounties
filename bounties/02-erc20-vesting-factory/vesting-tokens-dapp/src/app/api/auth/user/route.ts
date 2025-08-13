// Supabase + Drizzle auth/user route
import { NextRequest, NextResponse } from "next/server";
import { findUserByAddress, upsertUser } from "@/lib/drizzle/operations";
import { z } from "zod";

const createUserSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const updateUserSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

// POST: Get or create user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = createUserSchema.parse(body);

    // Get or create user with full relations
    let user = await findUserByAddress(address);
    let isNewUser = false;

    if (!user) {
      await upsertUser(address);
      user = await findUserByAddress(address);
      isNewUser = true;
    }

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Calculate user statistics
    const stats = {
      tokensDeployed: user.deployedTokens?.length || 0,
      totalBeneficiaries: user.deployedTokens?.reduce(
        (sum, token) => sum + (token.vestingSchedules?.length || 0),
        0
      ) || 0,
      tokensReceiving: user.vestingSchedules?.length || 0,
      totalTokensVested: user.vestingSchedules?.reduce(
        (sum, schedule) => sum + parseFloat(schedule.totalAmount),
        0
      ) || 0,
      totalTokensClaimed: user.vestingSchedules?.reduce(
        (sum, schedule) => sum + parseFloat(schedule.releasedAmount || "0"),
        0
      ) || 0,
    };

    return NextResponse.json({
      ...user,
      stats,
      isNewUser,
    });
  } catch (error) {
    console.error("User auth error:", error);
    return NextResponse.json(
      { error: "Failed to authenticate user" },
      { status: 500 }
    );
  }
}

// PATCH: Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, ...profileData } = updateUserSchema.parse(body);

    const user = await upsertUser(address, profileData);

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
