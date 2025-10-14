// src/components/beneficiary/vesting-schedules-list.tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUserData } from "@/lib/hooks/use-token-data";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  calculateVestingProgress,
  formatDuration,
  shortenAddress,
} from "@/lib/web3/utils";
import { ExternalLink, Gift } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useClaimVestedTokens } from "@/lib/hooks/useTokenVesting";
import { useEffect } from "react";
import { useVestingContractBalance } from "@/lib/hooks/useTokenFunding";
import { useChainId } from "wagmi";
import { getExplorerAddressUrl } from "@/lib/web3/config";

export function VestingSchedulesList() {
  const { data: userData, isLoading } = useUserData();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!userData?.vestingSchedules?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No vesting schedules found</p>
          <p className="text-sm text-muted-foreground">
            You don't have any tokens in vesting yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {userData.vestingSchedules.map((schedule: any) => (
        <VestingScheduleCard key={schedule.id} schedule={schedule} />
      ))}
    </div>
  );
}

function VestingScheduleCard({ schedule }: { schedule: any }) {
  const chainId = useChainId();
  const { toast } = useToast();

  const {
    claimTokens,
    isLoading: isClaiming,
    error,
    reset,
  } = useClaimVestedTokens(schedule.contractAddress);

  // ADD FUNDING CHECK
  const { hassufficientBalance } = useVestingContractBalance(
    schedule.token.address,
    schedule.contractAddress
  );

  const progress = calculateVestingProgress(
    new Date(schedule.startTime).getTime() / 1000,
    schedule.cliffDuration,
    schedule.vestingDuration
  );

  const totalAmount = parseFloat(schedule.totalAmount);
  const releasedAmount = parseFloat(schedule.releasedAmount || "0");
  const vestedAmount = (totalAmount * progress.progressPercentage) / 100;
  const claimableAmount = Math.max(0, vestedAmount - releasedAmount);

  // Handle transaction errors
  useEffect(() => {
    if (error) {
      console.error("Transaction error:", error);
      toast({
        title: "Transaction Failed",
        description:
          error.message || "The claim transaction failed. Please try again.",
        variant: "destructive",
      });
      reset();
    }
  }, [error, toast, reset]);

  const handleClaim = async () => {
    // CHECK FUNDING STATUS BEFORE CLAIMING
    if (!hassufficientBalance) {
      toast({
        title: "Contract Not Funded",
        description: `This vesting contract needs to be funded before you can claim.`,
        variant: "destructive",
      });
      return;
    }

    if (claimableAmount <= 0) {
      toast({
        title: "No tokens to claim",
        description: "There are no tokens available to claim at this time.",
        variant: "destructive",
      });
      return;
    }

    try {
      await claimTokens();
      toast({
        title: "Claim initiated",
        description: "Your token claim transaction has been submitted.",
      });
    } catch (error) {
      console.error("Claim error:", error);
    }
  };

  const getStatusColor = () => {
    if (schedule.revoked)
      return "bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900";
    if (progress.isVestingComplete)
      return "bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900";
    if (progress.isCliffPeriod)
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:text-yellow-900";
    return "bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900";
  };

  const getStatusText = () => {
    if (schedule.revoked) return "Revoked";
    if (progress.isVestingComplete) return "Complete";
    if (progress.isCliffPeriod) return "Cliff Period";
    return "Vesting";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-3">
              <span>
                {schedule.token.name} ({schedule.token.symbol})
              </span>
              <Badge className={getStatusColor()}>{getStatusText()}</Badge>
            </CardTitle>
            <CardDescription>
              {schedule.category} • Contract:{" "}
              {shortenAddress(schedule.contractAddress)}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {totalAmount.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Total Allocation
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Vesting Progress</span>
            <span>{progress.progressPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={progress.progressPercentage} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Started: {new Date(schedule.startTime).toLocaleDateString()}
            </span>
            <span>
              {progress.isVestingComplete
                ? "Completed"
                : `${formatDuration(progress.timeRemaining)} remaining`}
            </span>
          </div>
        </div>

        {/* Token Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Allocated</div>
            <div className="font-semibold">{totalAmount.toLocaleString()}</div>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Vested</div>
            <div className="font-semibold">
              {vestedAmount.toFixed(2).toLocaleString()}
            </div>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Claimed</div>
            <div className="font-semibold">
              {releasedAmount.toLocaleString()}
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Claimable</div>
            <div className="font-semibold text-green-600">
              {claimableAmount.toFixed(2).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Schedule Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Cliff Duration:</span>
            <p className="font-medium">
              {formatDuration(schedule.cliffDuration)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Vesting Duration:</span>
            <p className="font-medium">
              {formatDuration(schedule.vestingDuration)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Revocable:</span>
            <p className="font-medium">{schedule.revocable ? "Yes" : "No"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Claims Made:</span>
            <p className="font-medium">{schedule.claims?.length || 0}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleClaim}
            disabled={claimableAmount <= 0 || isClaiming}
            className="flex items-center gap-2"
          >
            <Gift className="h-4 w-4" />
            {isClaiming
              ? "Claiming..."
              : `Claim ${claimableAmount.toFixed(2)} Tokens`}
          </Button>

          <Button variant="outline" asChild>
            <a
              href={getExplorerAddressUrl(chainId, schedule.contractAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Contract
            </a>
          </Button>
        </div>

        {schedule.description && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-1">Description</div>
            <div className="text-sm text-muted-foreground">
              {schedule.description}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
