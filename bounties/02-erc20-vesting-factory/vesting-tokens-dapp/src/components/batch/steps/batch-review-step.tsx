// src/components/batch/steps/batch-review-step.tsx
"use client";

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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useBatchDeploymentStore } from "@/store/batch-deployment-store";
import { useBatchDeployTokens } from "@/lib/hooks/useBatchTokenVesting";
import {
  CheckCircle,
  ArrowLeft,
  Rocket,
  Coins,
  Users,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface BatchReviewStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function BatchReviewStep({ onNext, onPrevious }: BatchReviewStepProps) {
  const { address } = useAccount();
  const {
    tokenConfigs,
    vestingSchedules,
    beneficiaries,
    setBatchDeploymentResult,
    setIsBatchDeploymentComplete,
    getVestingSchedulesByToken,
    getBeneficiariesByToken,
    validateBatchConfiguration,
  } = useBatchDeploymentStore();

  const {
    deployBatchTokens,
    isDeploying,
    deploymentError,
    deploymentProgress,
  } = useBatchDeployTokens();

  const validation = validateBatchConfiguration();

  const handleDeploy = async () => {
    if (!validation.isValid || !address) return;

    console.log(tokenConfigs);

    try {
      const tokenParams = tokenConfigs.map((token) => ({
        ...token,
        totalSupply: parseEther(token.totalSupply).toString(), // Convert to wei
      }));

      const result = await deployBatchTokens(
        tokenParams,
        vestingSchedules,
        beneficiaries,
        address
      );

      if (result) {
        setBatchDeploymentResult(result);
        setIsBatchDeploymentComplete(true);
        onNext(); // Automatically advance to success step
      }
    } catch (error) {
      console.error("Deployment failed:", error);
      // Error is already handled by the hook
    }
  };

  const calculateTotalSupply = () => {
    return tokenConfigs.reduce(
      (total, token) => total + parseFloat(token.totalSupply || "0"),
      0
    );
  };

  const calculateTotalBeneficiaries = () => {
    return beneficiaries.length;
  };

  const calculateTotalAllocated = () => {
    return beneficiaries.reduce(
      (total, b) => total + parseFloat(b.amount || "0"),
      0
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Review & Deploy
        </CardTitle>
        <CardDescription>
          Review your batch configuration and deploy all tokens in a single
          transaction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Deployment Progress */}
        {isDeploying && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <h3 className="font-medium text-blue-800">
                  Deploying Batch...
                </h3>
              </div>
              <Progress value={deploymentProgress} className="mb-2" />
              <p className="text-sm text-blue-700">
                This may take a few minutes. Please don't close this window.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Deployment Error */}
        {deploymentError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Deployment failed: {deploymentError}
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Tokens</span>
            </div>
            <p className="text-2xl font-bold">{tokenConfigs.length}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Schedules</span>
            </div>
            <p className="text-2xl font-bold">{vestingSchedules.length}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Beneficiaries</span>
            </div>
            <p className="text-2xl font-bold">
              {calculateTotalBeneficiaries()}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Total Supply</span>
            </div>
            <p className="text-2xl font-bold">
              {calculateTotalSupply().toLocaleString()}
            </p>
          </Card>
        </div>

        {/* Token Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Token Configurations</h3>
          {tokenConfigs.map((token, index) => {
            const tokenSchedules = getVestingSchedulesByToken(token.id);
            const tokenBeneficiaries = getBeneficiariesByToken(token.id);
            const totalAllocated = tokenBeneficiaries.reduce(
              (sum, b) => sum + parseFloat(b.amount || "0"),
              0
            );

            return (
              <Card key={token.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <CardTitle className="text-lg">{token.name}</CardTitle>
                        <CardDescription>
                          {token.symbol} •{" "}
                          {parseFloat(token.totalSupply).toLocaleString()} total
                          supply
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {totalAllocated.toLocaleString()} allocated
                      </div>
                      <div className="text-muted-foreground">
                        {(
                          (totalAllocated / parseFloat(token.totalSupply)) *
                          100
                        ).toFixed(1)}
                        % of supply
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Vesting Schedules */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Vesting Schedules ({tokenSchedules.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {tokenSchedules.map((schedule) => (
                        <Card key={schedule.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="secondary">
                                {schedule.category}
                              </Badge>
                              <div className="text-sm text-muted-foreground mt-1">
                                {schedule.cliffMonths}mo cliff •{" "}
                                {schedule.vestingMonths}mo vesting
                              </div>
                            </div>
                            {schedule.revocable && (
                              <Badge variant="outline" className="text-xs">
                                Revocable
                              </Badge>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Beneficiaries */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Beneficiaries ({tokenBeneficiaries.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {tokenBeneficiaries.map((beneficiary) => (
                        <div
                          key={beneficiary.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <div className="flex items-center gap-3">
                            <code className="text-xs bg-white px-2 py-1 rounded">
                              {beneficiary.address.slice(0, 8)}...
                              {beneficiary.address.slice(-6)}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {beneficiary.category}
                            </Badge>
                          </div>
                          <div className="font-medium">
                            {parseFloat(beneficiary.amount).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Validation Errors */}
        {!validation.isValid && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Configuration Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700">
                    • {error}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Important Notes */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 text-lg">
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                All tokens and vesting contracts will be deployed in a single
                transaction
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                You will be the owner of all deployed token contracts
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                Vesting schedules will start immediately after deployment
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                This action cannot be undone. Please review carefully.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={isDeploying}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={!validation.isValid || isDeploying || !address}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Deploy Batch ({tokenConfigs.length} tokens)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
