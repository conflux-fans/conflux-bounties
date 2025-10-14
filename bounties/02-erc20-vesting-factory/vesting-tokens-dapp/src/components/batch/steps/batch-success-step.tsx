// src/components/batch/steps/batch-success-step.tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BatchDeploymentResult } from "@/store/batch-deployment-store";
import {
  CheckCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Download,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/lib/hooks/use-toast";
import { getExplorerAddressUrl, getExplorerTxUrl } from "@/lib/web3/config";
import { useChainId } from "wagmi";

interface BatchSuccessStepProps {
  deploymentResult: BatchDeploymentResult | null;
  onReset: () => void;
}

export function BatchSuccessStep({
  deploymentResult,
  onReset,
}: BatchSuccessStepProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { toast } = useToast();
  const chainId = useChainId();

  if (!deploymentResult) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              No deployment result available
            </h3>
            <p className="text-muted-foreground mb-4">
              Something went wrong during the deployment process.
            </p>
            <Button onClick={onReset}>Start Over</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getExplorerUrl = (address: string) => {
    return getExplorerAddressUrl(chainId, address);
  };

  const getTxExplorerUrl = (txHash: string) => {
    return getExplorerTxUrl(chainId, txHash);
  };

  const downloadDeploymentReport = () => {
    const report = {
      batchId: deploymentResult.batchId,
      deployedAt: deploymentResult.deployedAt.toISOString(),
      transactionHash: deploymentResult.transactionHash,
      tokens: deploymentResult.tokens.map((token, index) => ({
        ...token,
        vestingContracts: deploymentResult.vestingContracts[index] || [],
      })),
      databaseSaved: deploymentResult.databaseSaved,
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batch-deployment-${deploymentResult.batchId.slice(
      0,
      8
    )}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl text-green-600">
          Batch Deployment Successful!
        </CardTitle>
        <CardDescription>
          All {deploymentResult.tokens.length} tokens have been deployed
          successfully
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Deployment Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {deploymentResult.tokens.length}
            </div>
            <p className="text-sm text-muted-foreground">Tokens Deployed</p>
          </Card>

          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {deploymentResult.vestingContracts.flat().length}
            </div>
            <p className="text-sm text-muted-foreground">Vesting Contracts</p>
          </Card>

          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">1</div>
            <p className="text-sm text-muted-foreground">Transaction</p>
          </Card>

          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {deploymentResult.databaseSaved ? "✓" : "⚠"}
            </div>
            <p className="text-sm text-muted-foreground">Database Status</p>
          </Card>
        </div>

        {/* Transaction Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">
                  Batch ID:
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {deploymentResult.batchId.slice(0, 16)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(deploymentResult.batchId, "Batch ID")
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div>
                <span className="font-medium text-muted-foreground">
                  Deployed At:
                </span>
                <p className="mt-1">
                  {deploymentResult.deployedAt.toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <span className="font-medium text-muted-foreground">
                Transaction Hash:
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">
                  {deploymentResult.transactionHash}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      deploymentResult.transactionHash,
                      "Transaction hash"
                    )
                  }
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.open(
                      getTxExplorerUrl(deploymentResult.transactionHash),
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Status Alert */}
        {!deploymentResult.databaseSaved && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Warning: The deployment was successful on-chain, but there was an
              issue saving the data to our database. Your tokens are deployed
              and functional, but they may not appear in your dashboard
              immediately.
            </AlertDescription>
          </Alert>
        )}

        {/* Deployed Tokens */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Deployed Tokens</h3>
          {deploymentResult.tokens.map((token, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <CardTitle className="text-lg">{token.name}</CardTitle>
                      <CardDescription>{token.symbol}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(token.address, `${token.name} address`)
                      }
                    >
                      {copiedAddress === token.address ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(getExplorerUrl(token.address), "_blank")
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    Token Address:
                  </span>
                  <code className="block bg-gray-100 px-3 py-2 rounded text-xs mt-1">
                    {token.address}
                  </code>
                </div>

                {deploymentResult.vestingContracts[index] &&
                  deploymentResult.vestingContracts[index].length > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground text-sm">
                        Vesting Contracts (
                        {deploymentResult.vestingContracts[index].length}):
                      </span>
                      <div className="space-y-2 mt-2">
                        {deploymentResult.vestingContracts[index].map(
                          (vestingAddress, vestingIndex) => (
                            <div
                              key={vestingIndex}
                              className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                            >
                              <code className="text-xs">
                                {vestingAddress.slice(0, 8)}...
                                {vestingAddress.slice(-6)}
                              </code>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    copyToClipboard(
                                      vestingAddress,
                                      `Vesting contract ${vestingIndex + 1}`
                                    )
                                  }
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    window.open(
                                      getExplorerUrl(vestingAddress),
                                      "_blank"
                                    )
                                  }
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Next Steps */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="text-green-700 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Your tokens are now live on the blockchain and ready to use
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Beneficiaries can start claiming vested tokens according to
                their schedules
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ExternalLink className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Visit your dashboard to monitor vesting progress and manage your
                tokens
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <Button
            onClick={downloadDeploymentReport}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>

          <Button
            onClick={() => window.open("/dashboard", "_blank")}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View Dashboard
          </Button>

          <Button
            onClick={onReset}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Deploy Another Batch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
