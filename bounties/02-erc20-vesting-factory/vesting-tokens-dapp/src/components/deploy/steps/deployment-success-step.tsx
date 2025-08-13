// src/components/deploy/steps/deployment-success-step.tsx - UPDATED with backend integration
"use client";

import { useState } from "react";
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
import { useToast } from "@/lib/hooks/use-toast";
import {
  CheckCircle,
  Copy,
  ExternalLink,
  Users,
  Clock,
  AlertCircle,
  RefreshCw,
  Database,
  Coins,
  Download,
} from "lucide-react";
import { useDeploymentStore } from "@/store/deployment-store";
import type { DeploymentResult } from "@/lib/hooks/useTokenVestingFactory";
import { PostDeploymentActions } from "@/components/deploy/PostDeploymentActions";
import { useAccount, useChainId } from "wagmi";
import { getExplorerUrl } from "@/lib/web3/config";

interface DeploymentSuccessStepProps {
  deploymentResult: DeploymentResult | null;
  onReset: () => void;
  retryDatabaseSave?: () => Promise<void>;
  isSavingToDatabase?: boolean;
}

export function DeploymentSuccessStep({
  deploymentResult,
  onReset,
  retryDatabaseSave,
  isSavingToDatabase = false,
}: DeploymentSuccessStepProps) {
  const { tokenConfig, vestingSchedules, beneficiaries } = useDeploymentStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const exportDeploymentData = () => {
    const data = {
      deployment: {
        timestamp: deploymentResult?.deployedAt,
        transactionHash: deploymentResult?.transactionHash,
        tokenAddress: deploymentResult?.tokenAddress,
        vestingContracts: deploymentResult?.vestingContracts,
        databaseSaved: deploymentResult?.databaseSaved,
      },
      token: {
        name: tokenConfig?.name,
        symbol: tokenConfig?.symbol,
        totalSupply: tokenConfig?.totalSupply,
        decimals: tokenConfig?.decimals,
      },
      vestingSchedules: vestingSchedules,
      beneficiaries: beneficiaries,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      tokenConfig?.symbol || "token"
    }-deployment-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Deployment data has been downloaded as JSON",
    });
  };

  // Check if addresses are valid (not empty or placeholder)
  const isValidAddress = (address: string) => {
    return (
      address &&
      address !== "" &&
      address !== "0x..." &&
      address !== "0x" &&
      address.length === 42 &&
      address.startsWith("0x")
    );
  };

  const hasValidTokenAddress = isValidAddress(
    deploymentResult?.tokenAddress || ""
  );

  if (!deploymentResult) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <p className="text-muted-foreground">Deployment result not found</p>
          <Button onClick={onReset} className="mt-4">
            Start Over
          </Button>
        </CardContent>
      </Card>
    );
  }

  const explorerBaseUrl = getExplorerUrl(chainId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Deployment{" "}
            {deploymentResult.databaseSaved ? "Complete" : "Partially Complete"}
          </CardTitle>
          <CardDescription>
            {deploymentResult.databaseSaved
              ? "Your token and vesting contracts have been deployed successfully and saved to the database."
              : "Your token has been deployed to the blockchain, but there was an issue saving to the database."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Database Status */}
          {/* <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Database
                className={`h-5 w-5 ${
                  deploymentResult.databaseSaved
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              />
              <div>
                <div className="font-medium">Database Status</div>
                <div className="text-sm text-muted-foreground">
                  {deploymentResult.databaseSaved
                    ? "Deployment data saved successfully"
                    : "Failed to save deployment data"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {deploymentResult.databaseSaved ? (
                <Badge
                  variant="default"
                  className="bg-green-100 text-green-800"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Saved
                </Badge>
              ) : (
                <>
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                  {retryDatabaseSave && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryDatabaseSave}
                      disabled={isSavingToDatabase}
                    >
                      {isSavingToDatabase ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry Save
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div> */}

          {/* Post Deployment Actions */}
          <PostDeploymentActions
            deploymentResult={deploymentResult}
            tokenConfig={tokenConfig!}
            beneficiaries={beneficiaries}
            userAddress={userAddress!}
          />

          {/* Token Contract */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Token Contract
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Token Address
                  </div>
                  {hasValidTokenAddress ? (
                    <div className="flex items-center justify-between">
                      <code className="text-sm bg-background px-2 py-1 rounded">
                        {deploymentResult.tokenAddress}
                      </code>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            copyToClipboard(
                              deploymentResult.tokenAddress,
                              "Token Address"
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-6 w-6 p-0"
                        >
                          <a
                            href={`${explorerBaseUrl}/token/${deploymentResult.tokenAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-yellow-600">Address pending...</div>
                  )}
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Transaction Hash
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-sm bg-background px-2 py-1 rounded">
                      {deploymentResult.transactionHash.slice(0, 10)}...
                      {deploymentResult.transactionHash.slice(-8)}
                    </code>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          copyToClipboard(
                            deploymentResult.transactionHash,
                            "Transaction Hash"
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-6 w-6 p-0"
                      >
                        <a
                          href={`${explorerBaseUrl}/tx/${deploymentResult.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Deployed At
                  </div>
                  <div className="font-medium">
                    {new Date(deploymentResult.deployedAt).toLocaleString()}
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Token Details
                  </div>
                  <div className="font-medium">
                    {tokenConfig?.name} ({tokenConfig?.symbol})
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Vesting Contracts */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vesting Contracts (
              {deploymentResult.vestingContracts?.length || 0})
            </h3>

            {deploymentResult.vestingContracts?.length ? (
              <div className="space-y-2">
                {deploymentResult.vestingContracts.map(
                  (contractAddress, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          Vesting Contract #{index + 1}
                        </div>
                        {isValidAddress(contractAddress) ? (
                          <code className="text-xs text-muted-foreground">
                            {contractAddress}
                          </code>
                        ) : (
                          <span className="text-xs text-yellow-600">
                            Address pending...
                          </span>
                        )}
                      </div>
                      {isValidAddress(contractAddress) && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              copyToClipboard(
                                contractAddress,
                                `Vesting Contract ${index + 1}`
                              )
                            }
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-6 w-6 p-0"
                          >
                            <a
                              href={`${explorerBaseUrl}/address/${contractAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                <p className="text-yellow-800 font-medium">
                  Vesting contracts pending
                </p>
                <p className="text-yellow-700 text-sm">
                  Contract addresses will be available once the transaction is
                  fully processed
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {vestingSchedules.length}
              </div>
              <div className="text-sm text-blue-800">Vesting Schedules</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {beneficiaries.length}
              </div>
              <div className="text-sm text-green-800">Beneficiaries</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {tokenConfig?.totalSupply
                  ? Number(tokenConfig.totalSupply).toLocaleString()
                  : "0"}
              </div>
              <div className="text-sm text-purple-800">Total Supply</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {deploymentResult.databaseSaved ? "100%" : "50%"}
              </div>
              <div className="text-sm text-orange-800">Completion</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={exportDeploymentData}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>

            {!deploymentResult.databaseSaved && retryDatabaseSave && (
              <Button
                onClick={retryDatabaseSave}
                disabled={isSavingToDatabase}
                className="flex-1"
              >
                {isSavingToDatabase ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving to Database...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Retry Database Save
                  </>
                )}
              </Button>
            )}

            <Button onClick={onReset} variant="outline" className="flex-1">
              Deploy Another Token
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
