// app/src/components/beneficiary/BeneficiaryDashboard.tsx
import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccount } from "wagmi";
import { useUserData } from "@/lib/hooks/use-token-data";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Coins, Clock, TrendingUp, Gift, AlertTriangle } from "lucide-react";
import { VestingProgressChart } from "@/components/charts/vesting-progress-chart";
import { calculateVestingProgress } from "@/lib/web3/utils";
import { useVestingContractBalance } from "@/lib/hooks/useTokenFunding";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { weiToTokens } from "@/lib/utils/tokenUtils";

export function BeneficiaryDashboard() {
  const { address } = useAccount();
  const { data: userData, isLoading, error } = useUserData();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !userData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Failed to load beneficiary data
          </p>
        </CardContent>
      </Card>
    );
  }

  const { stats, vestingSchedules } = userData;

  // Check funding status for all schedules
  const fundingStatuses = vestingSchedules.map((schedule: any) => {
    const { hassufficientBalance } = useVestingContractBalance(
      schedule.token.address,
      schedule.contract_address
    );
    return { ...schedule, hassufficientBalance };
  });

  const unfundedCount = fundingStatuses.filter(
    (s: any) => !s.hassufficientBalance
  ).length;

  // Calculate claimable amounts (only for funded contracts)
  const claimableSchedules = fundingStatuses.filter((schedule: any) => {
    if (!schedule.hassufficientBalance) return false;

    const now = Date.now() / 1000;
    const startTime = new Date(schedule.startTime).getTime() / 1000;
    const cliffEnd = startTime + schedule.cliffDuration;
    return now >= cliffEnd && !schedule.revoked;
  });

  const totalClaimable = claimableSchedules.reduce(
    (sum: number, schedule: any) => {
      const progress = calculateVestingProgress(
        new Date(schedule.startTime).getTime() / 1000,
        schedule.cliffDuration,
        schedule.vestingDuration
      );
      const totalAmount = parseFloat(schedule.totalAmount);
      const releasedAmount = parseFloat(schedule.releasedAmount || "0");
      const vestedAmount = (totalAmount * progress.progressPercentage) / 100;
      return sum + Math.max(0, vestedAmount - releasedAmount);
    },
    0
  );

  return (
    <div className="space-y-6">
      {/* Unfunded Contracts Alert */}
      {/* {unfundedCount > 0 && (
        <Alert variant="destructive" className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <div className="space-y-1">
              <p className="font-medium">
                ⏳ {unfundedCount} of your vesting contracts are not yet funded
              </p>
              <p className="text-sm">
                You cannot claim from unfunded contracts. Contact the token
                owners to fund these contracts.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )} */}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vested</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTokensVested.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {stats.activeSchedules} schedules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claimed</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {weiToTokens(BigInt(stats.totalTokensClaimed)).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(
                (weiToTokens(BigInt(stats.totalTokensClaimed)) /
                  stats.totalTokensVested) *
                100
              ).toFixed(2)}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claimable Now</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalClaimable.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From funded contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Awaiting Funding
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {unfundedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Contracts need funding
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vesting Progress Chart */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Vesting Progress Overview</CardTitle>
          <CardDescription>
            Track your token vesting progress across all positions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VestingProgressChart data={vestingSchedules} />
        </CardContent>
      </Card> */}

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ready to Claim</CardTitle>
            <CardDescription>
              Funded contracts with claimable tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalClaimable > 0 ? (
              <div className="text-center py-4">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {totalClaimable.toLocaleString()}
                </div>
                <p className="text-muted-foreground">tokens ready to claim</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  No tokens available to claim yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Check back later or when contracts are funded
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {unfundedCount > 0 ? (
              <div className="text-center py-4">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                <div className="text-2xl font-bold text-orange-600 mb-2">
                  {unfundedCount}
                </div>
                <p className="text-muted-foreground">
                  contracts awaiting funding
                </p>
                <p className="text-sm text-muted-foreground">
                  Contact token owners to fund these contracts
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <Gift className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-green-600 font-medium">
                  All contracts funded!
                </p>
                <p className="text-sm text-muted-foreground">
                  You can claim tokens as they vest
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
