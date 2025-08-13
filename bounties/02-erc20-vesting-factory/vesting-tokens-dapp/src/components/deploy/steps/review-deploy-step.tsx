// src/components/deploy/steps/review-deploy-step.tsx - UPDATED to pass data to backend
"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/lib/hooks/use-toast";
import { useDeploymentStore } from "@/store/deployment-store";
import { useDeployTokenWithVesting } from "@/lib/hooks/useTokenVestingFactory";
import {
  CheckCircle,
  AlertTriangle,
  Shield,
  Loader2,
  ArrowLeft,
  Users,
  Coins,
  Clock,
} from "lucide-react";

interface ReviewDeployStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function ReviewDeployStep({
  onNext,
  onPrevious,
}: ReviewDeployStepProps) {
  const [confirmedDetails, setConfirmedDetails] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const { address } = useAccount();
  const { toast } = useToast();

  const {
    tokenConfig,
    vestingSchedules,
    beneficiaries,
    setDeploying,
    setDeploymentResult,
    setDeploymentError,
  } = useDeploymentStore();

  const {
    deployToken,
    deploymentResult,
    deploymentError,
    isLoading,
    isSuccess,
    isParsingAddresses,
    isSavingToDatabase,
  } = useDeployTokenWithVesting();

  // Calculate total allocation
  const totalAllocated = beneficiaries.reduce(
    (sum, beneficiary) => sum + parseFloat(beneficiary.amount),
    0
  );
  const totalSupply = parseFloat(tokenConfig?.totalSupply || "0");
  const allocationPercentage =
    totalSupply > 0 ? (totalAllocated / totalSupply) * 100 : 0;

  // Validation checks
  const validationChecks = [
    {
      id: "wallet-connected",
      label: "Wallet Connected",
      passed: !!address,
      message: address
        ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`
        : "Please connect your wallet",
    },
    {
      id: "token-config",
      label: "Token Configuration",
      passed: !!(
        tokenConfig?.name &&
        tokenConfig?.symbol &&
        tokenConfig?.totalSupply
      ),
      message: tokenConfig
        ? `${tokenConfig.name} (${tokenConfig.symbol})`
        : "Token configuration incomplete",
    },
    {
      id: "vesting-schedules",
      label: "Vesting Schedules",
      passed: vestingSchedules.length > 0,
      message: `${vestingSchedules.length} schedule(s) created`,
    },
    {
      id: "beneficiaries",
      label: "Beneficiaries",
      passed: beneficiaries.length > 0,
      message: `${beneficiaries.length} beneficiary(ies) added`,
    },
    {
      id: "allocation-check",
      label: "Token Allocation",
      passed: allocationPercentage <= 100,
      message:
        allocationPercentage <= 100
          ? `${allocationPercentage.toFixed(1)}% of total supply allocated`
          : `Over-allocated: ${allocationPercentage.toFixed(
              1
            )}% of total supply`,
    },
  ];

  const canDeploy =
    validationChecks.every((check) => check.passed) &&
    agreedToTerms &&
    confirmedDetails &&
    !isLoading;

  // UPDATED: Deploy function with backend integration
  const handleDeploy = async () => {
    if (!canDeploy || !tokenConfig || !address) return;

    try {
      setDeploying(true);

      // Prepare contract parameters
      const tokenParams = {
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        totalSupply: parseEther(tokenConfig.totalSupply),
        owner: address as `0x${string}`,
      };

      const vestingParams = beneficiaries.map((beneficiary) => {
        const schedule = vestingSchedules.find(
          (s) => s.category === beneficiary.category
        )!;
        return {
          beneficiary: beneficiary.address as `0x${string}`,
          amount: parseEther(beneficiary.amount),
          cliff: BigInt(schedule.cliffMonths * 30 * 24 * 60 * 60),
          duration: BigInt(schedule.vestingMonths * 30 * 24 * 60 * 60),
          revocable: schedule.revocable,
        };
      });

      console.log("Deploying contracts...", { tokenParams, vestingParams });

      // Deploy to blockchain - this will now also save to backend
      await deployToken(
        tokenParams,
        vestingParams,
        vestingSchedules, // Pass for backend save
        beneficiaries // Pass for backend save
      );

      toast({
        title: "Deployment initiated",
        description:
          "Your token deployment transaction has been submitted to the blockchain.",
      });
    } catch (deployError) {
      console.error("Deployment failed:", deployError);
      setDeploymentError(
        deployError instanceof Error ? deployError.message : "Deployment failed"
      );
      setDeploying(false);

      toast({
        title: "Deployment failed",
        description: "Failed to deploy token contracts. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle successful deployment
  if (isSuccess && deploymentResult) {
    setDeploymentResult({
      tokenAddress: deploymentResult.tokenAddress,
      vestingContracts: deploymentResult.vestingContracts,
      transactionHash: deploymentResult.transactionHash,
      deployedAt: deploymentResult.deployedAt,
      databaseSaved: deploymentResult.databaseSaved,
    });
    onNext();
    return null;
  }

  const error = deploymentError;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Review & Deploy
          </CardTitle>
          <CardDescription>
            Please review your configuration before deploying to the blockchain.
            This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Configuration Summary */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Token Configuration
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <div className="font-medium">{tokenConfig?.name}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Symbol:</span>
                  <div className="font-medium">{tokenConfig?.symbol}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Total Supply:
                  </span>
                  <div className="font-medium">
                    {tokenConfig?.totalSupply
                      ? Number(tokenConfig.totalSupply).toLocaleString()
                      : "0"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Decimals:
                  </span>
                  <div className="font-medium">
                    {tokenConfig?.decimals || 18}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vesting Schedules Summary */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Vesting Schedules ({vestingSchedules.length})
            </h3>
            <div className="space-y-2">
              {vestingSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-medium">{schedule.category}</div>
                    <div className="text-sm text-muted-foreground">
                      {schedule.cliffMonths}m cliff + {schedule.vestingMonths}m
                      vesting
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {schedule.revocable && (
                      <Badge variant="secondary" className="text-xs">
                        Revocable
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Beneficiaries Summary */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Beneficiaries ({beneficiaries.length})
            </h3>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {totalAllocated.toLocaleString()}
              </div>
              <div className="text-sm text-blue-800">
                Total Tokens Allocated ({allocationPercentage.toFixed(1)}% of
                supply)
              </div>
            </div>
          </div>

          {/* Validation Checks */}
          <div className="space-y-4">
            <h3 className="font-semibold">Pre-deployment Validation</h3>
            <div className="space-y-3">
              {validationChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {check.passed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">{check.label}</span>
                  </div>
                  <span
                    className={`text-sm ${
                      check.passed ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {check.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirm-details"
                checked={confirmedDetails}
                onCheckedChange={(checked) =>
                  setConfirmedDetails(checked === true)
                }
                disabled={isLoading}
              />
              <label htmlFor="confirm-details" className="text-sm font-medium">
                I have reviewed all configuration details and they are correct
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) =>
                  setAgreedToTerms(checked === true)
                }
                disabled={isLoading}
              />
              <label htmlFor="agree-terms" className="text-sm font-medium">
                I understand that smart contract deployments are irreversible
                and agree to the terms
              </label>
            </div>
          </div>

          {error && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Deployment failed: {error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} disabled={isLoading}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <Button
          onClick={handleDeploy}
          disabled={!canDeploy}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isParsingAddresses
                ? "Parsing Addresses..."
                : isSavingToDatabase
                ? "Saving to Database..."
                : "Deploying..."}
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Deploy Contracts
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
