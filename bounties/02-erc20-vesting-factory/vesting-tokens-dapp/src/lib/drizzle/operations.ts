// Database operations with Drizzle + Supabase
import { db } from "./client";
import {
  users,
  deployedTokens,
  vestingSchedules,
  vestingClaims,
  type NewUser,
  type NewDeployedToken,
  type NewVestingSchedule,
  type NewVestingClaim,
} from "./schema";
import { eq, desc, and } from "drizzle-orm";

// User operations
export async function createUser(data: Omit<NewUser, "id">) {
  const [result] = await db.insert(users).values(data).returning();
  return result;
}

export async function findUserByAddress(address: string) {
  return await db.query.users.findFirst({
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
}

export async function upsertUser(
  address: string,
  updateData?: Partial<Omit<NewUser, "id" | "address">>
) {
  // Try to find existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.address, address),
  });

  if (existingUser) {
    if (updateData && Object.keys(updateData).length > 0) {
      const [updated] = await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.address, address))
        .returning();
      return updated;
    }
    return existingUser;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        address,
        ...updateData,
      })
      .returning();
    return created;
  }
}

// Token operations
export async function saveDeployedToken(data: Omit<NewDeployedToken, "id">) {
  const [result] = await db.insert(deployedTokens).values(data).returning();
  return result;
}

export async function getDeployedTokensByOwner(ownerAddress: string) {
  return await db.query.deployedTokens.findMany({
    where: eq(deployedTokens.ownerAddress, ownerAddress),
    with: {
      vestingSchedules: {
        with: {
          claims: true,
        },
      },
    },
    orderBy: [desc(deployedTokens.createdAt)],
  });
}

// Vesting operations
export async function saveVestingSchedule(
  data: Omit<NewVestingSchedule, "id">
) {
  const [result] = await db.insert(vestingSchedules).values(data).returning();
  return result;
}

export async function getVestingSchedulesByBeneficiary(
  beneficiaryAddress: string
) {
  return await db.query.vestingSchedules.findMany({
    where: eq(vestingSchedules.beneficiaryAddress, beneficiaryAddress),
    with: {
      token: true,
      claims: true,
    },
    orderBy: [desc(vestingSchedules.createdAt)],
  });
}

// Claim operations
export async function recordVestingClaim(data: Omit<NewVestingClaim, "id">) {
  const [result] = await db.insert(vestingClaims).values(data).returning();
  return result;
}

// Analytics
export async function getDeploymentAnalytics(ownerAddress?: string) {
  let tokensQuery = db.query.deployedTokens.findMany({
    with: {
      vestingSchedules: true,
    },
  });

  if (ownerAddress) {
    tokensQuery = db.query.deployedTokens.findMany({
      where: eq(deployedTokens.ownerAddress, ownerAddress),
      with: {
        vestingSchedules: true,
      },
    });
  }

  const data = await tokensQuery;

  const totalTokens = data.length;
  const totalSupply = data.reduce(
    (sum, token) => sum + parseFloat(token.totalSupply),
    0
  );
  const totalVestingSchedules = data.reduce(
    (sum, token) => sum + token.vestingSchedules.length,
    0
  );

  return {
    totalTokens,
    totalSupply,
    totalVestingSchedules,
    tokens: data,
  };
}

// Batch operations for better performance with Supabase
export async function batchCreateVestingSchedules(
  schedules: Omit<NewVestingSchedule, "id">[]
) {
  if (schedules.length === 0) return [];

  return await db.insert(vestingSchedules).values(schedules).returning();
}

export async function batchCreateUsers(usersData: Omit<NewUser, "id">[]) {
  if (usersData.length === 0) return [];

  return await db.insert(users).values(usersData).returning();
}
