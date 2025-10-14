// src/app/api/batch-deployment/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/client";
import {
  users,
  deployedTokens,
  vestingSchedules as vestingSchedulesTable,
} from "@/lib/drizzle/schema";

import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { rateLimitPOST, rateLimitGET, getClientIdentifier } from "@/lib/api/rate-limit";
import { sanitizeOptionalFields } from "@/lib/api/sanitize";

const saveBatchDeploymentSchema = z.object({
  deploymentResult: z.object({
    batchId: z.string(),
    tokens: z.array(
      z.object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        name: z.string(),
        symbol: z.string(),
      })
    ),
    vestingContracts: z.array(z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))),
    transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    deployedAt: z.string().datetime(),
  }),
  tokenConfigs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      totalSupply: z.string(),
      decimals: z.number(),
      description: z.string().optional(),
      website: z.string().optional(),
      logo: z.string().optional(),
    })
  ),
  vestingSchedules: z.array(
    z.object({
      id: z.string(),
      tokenId: z.string(),
      category: z.string(),
      cliffMonths: z.number(),
      vestingMonths: z.number(),
      revocable: z.boolean(),
    })
  ),
  beneficiaries: z.array(
    z.object({
      id: z.string(),
      tokenId: z.string(),
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      amount: z.string(),
      category: z.string(),
    })
  ),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
          },
        }
      );
    }

    const body = await request.json();
    const data = saveBatchDeploymentSchema.parse(body);

    const {
      deploymentResult,
      tokenConfigs,
      vestingSchedules,
      beneficiaries,
      ownerAddress,
    } = data;

    // ✅ WRAP ALL DATABASE OPERATIONS IN A TRANSACTION
    const result = await db.transaction(async (tx) => {
      // Create user if doesn't exist (upsert)
      await tx
        .insert(users)
        .values({ address: ownerAddress })
        .onConflictDoNothing({ target: users.address });

      const savedTokens = [];

      // Process each token in the batch
      for (let i = 0; i < tokenConfigs.length; i++) {
        const tokenConfig = tokenConfigs[i];
        const tokenResult = deploymentResult.tokens[i];
        const tokenVestingContracts = deploymentResult.vestingContracts[i] || [];

        // ✅ SANITIZE OPTIONAL FIELDS
        const sanitizedConfig = sanitizeOptionalFields(tokenConfig, [
          "description",
          "website",
          "logo",
        ]);

        // Save deployed token
        const [savedToken] = await tx
          .insert(deployedTokens)
          .values({
            address: tokenResult.address,
            name: tokenConfig.name,
            symbol: tokenConfig.symbol,
            totalSupply: tokenConfig.totalSupply,
            decimals: tokenConfig.decimals,
            ownerAddress: ownerAddress,
            factoryTxHash: deploymentResult.transactionHash,
            deployedAt: new Date(deploymentResult.deployedAt),
            description: sanitizedConfig.description || null,
            website: sanitizedConfig.website || null,
            logo: sanitizedConfig.logo || null,
          })
          .returning();

        savedTokens.push({ ...savedToken, originalId: tokenConfig.id });

        // Get beneficiaries for this token
        const tokenBeneficiaries = beneficiaries.filter(
          (b) => b.tokenId === tokenConfig.id
        );

        // Save vesting schedules for each beneficiary
        for (let j = 0; j < tokenBeneficiaries.length; j++) {
          const beneficiary = tokenBeneficiaries[j];
          const schedule = vestingSchedules.find(
            (s) =>
              s.tokenId === tokenConfig.id && s.category === beneficiary.category
          );

          if (!schedule) {
            throw new Error(
              `No vesting schedule found for beneficiary ${beneficiary.address} in category ${beneficiary.category}`
            );
          }

          // Use the corresponding vesting contract address
          const vestingContractAddress =
            tokenVestingContracts[j] || tokenVestingContracts[0];

          if (!vestingContractAddress) {
            throw new Error(
              `No vesting contract address found for beneficiary ${beneficiary.address}`
            );
          }

          await tx.insert(vestingSchedulesTable).values({
            tokenId: savedToken.id,
            contractAddress: vestingContractAddress,
            beneficiaryAddress: beneficiary.address,
            totalAmount: beneficiary.amount,
            cliffDuration: schedule.cliffMonths * 30 * 24 * 60 * 60, // Convert to seconds
            vestingDuration: schedule.vestingMonths * 30 * 24 * 60 * 60, // Convert to seconds
            startTime: new Date(deploymentResult.deployedAt),
            releasedAmount: "0",
            revoked: false,
            category: beneficiary.category,
          });
        }
      }

      return {
        batchId: deploymentResult.batchId,
        savedTokens,
        totalTokens: tokenConfigs.length,
        totalVestingSchedules: beneficiaries.length,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.reset.toString(),
        },
      }
    );
  } catch (error) {
    console.error("Batch deployment API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details: error instanceof z.ZodError ? error.errors : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const ownerAddress = searchParams.get("ownerAddress");
    const analytics = searchParams.get("analytics");

    if (batchId) {
      // Get specific batch deployment by transaction hash
      const tokens = await db.query.deployedTokens.findMany({
        where: eq(deployedTokens.factoryTxHash, batchId),
        with: {
          vestingSchedules: {
            with: {
              claims: true,
            },
          },
        },
        orderBy: [deployedTokens.createdAt],
      });

      return NextResponse.json({
        success: true,
        data: {
          batchId,
          tokens,
          totalTokens: tokens.length,
          totalVestingSchedules: tokens.reduce(
            (sum, token) => sum + (token.vestingSchedules?.length || 0),
            0
          ),
        },
      });
    }

    if (analytics === "true") {
      // Get analytics
      let tokensQuery = db.query.deployedTokens.findMany({
        with: {
          vestingSchedules: {
            with: {
              claims: true,
            },
          },
        },
      });

      // Filter by owner if specified
      if (ownerAddress) {
        tokensQuery = db.query.deployedTokens.findMany({
          where: eq(deployedTokens.ownerAddress, ownerAddress),
          with: {
            vestingSchedules: {
              with: {
                claims: true,
              },
            },
          },
        });
      }

      const tokens = await tokensQuery;

      // Calculate analytics
      const totalTokens = tokens.length;
      const totalSupply = tokens.reduce(
        (sum, token) => sum + parseFloat(token.totalSupply || "0"),
        0
      );

      const totalVestingSchedules = tokens.reduce(
        (sum, token) => sum + (token.vestingSchedules?.length || 0),
        0
      );

      const totalAllocated = tokens.reduce(
        (sum, token) =>
          sum +
          (token.vestingSchedules?.reduce(
            (scheduleSum, schedule) =>
              scheduleSum + parseFloat(schedule.totalAmount || "0"),
            0
          ) || 0),
        0
      );

      const totalReleased = tokens.reduce(
        (sum, token) =>
          sum +
          (token.vestingSchedules?.reduce(
            (scheduleSum, schedule) =>
              scheduleSum + parseFloat(schedule.releasedAmount || "0"),
            0
          ) || 0),
        0
      );

      // Group by batch (transaction hash)
      const batches = new Map();
      tokens.forEach((token) => {
        const batchId = token.factoryTxHash;
        if (!batches.has(batchId)) {
          batches.set(batchId, {
            batchId,
            deployedAt: token.deployedAt,
            tokenCount: 0,
            tokens: [],
          });
        }
        const batch = batches.get(batchId);
        batch.tokenCount++;
        batch.tokens.push(token);
      });

      const totalBatches = batches.size;

      // Category breakdown
      const categoryStats = new Map();
      tokens.forEach((token) => {
        token.vestingSchedules?.forEach((schedule) => {
          const category = schedule.category || "Uncategorized";
          if (!categoryStats.has(category)) {
            categoryStats.set(category, {
              category,
              totalAmount: 0,
              releasedAmount: 0,
              scheduleCount: 0,
            });
          }
          const stats = categoryStats.get(category);
          stats.totalAmount += parseFloat(schedule.totalAmount || "0");
          stats.releasedAmount += parseFloat(schedule.releasedAmount || "0");
          stats.scheduleCount++;
        });
      });

      return NextResponse.json({
        success: true,
        data: {
          totalBatches,
          totalTokens,
          totalSupply,
          totalVestingSchedules,
          totalAllocated,
          totalReleased,
          vestingProgress:
            totalAllocated > 0 ? (totalReleased / totalAllocated) * 100 : 0,
          categoryBreakdown: Array.from(categoryStats.values()),
          recentBatches: Array.from(batches.values())
            .sort(
              (a, b) =>
                new Date(b.deployedAt).getTime() -
                new Date(a.deployedAt).getTime()
            )
            .slice(0, 5),
        },
      });
    }

    if (ownerAddress) {
      // Get all batch deployments for owner
      const tokens = await db.query.deployedTokens.findMany({
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

      // Group by transaction hash (batch ID)
      const batches = new Map();
      tokens.forEach((token) => {
        const batchId = token.factoryTxHash;
        if (!batches.has(batchId)) {
          batches.set(batchId, {
            batchId,
            tokens: [],
            deployedAt: token.deployedAt,
            totalVestingSchedules: 0,
          });
        }

        const batch = batches.get(batchId);
        batch.tokens.push(token);
        batch.totalVestingSchedules += token.vestingSchedules?.length || 0;
      });

      return NextResponse.json({
        success: true,
        data: Array.from(batches.values()),
      });
    }

    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Batch deployment GET API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
