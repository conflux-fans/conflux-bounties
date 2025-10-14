// app/src/components/deploy/PostDeploymentActions.tsx (UPDATED)
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { BulkFundingDialog } from "../vesting/BulkFundingDialog";
import {
  Beneficiary,
  DeploymentResult,
  TokenConfig,
} from "@/store/deployment-store";

interface PostDeploymentActionsProps {
  deploymentResult: DeploymentResult;
  tokenConfig: TokenConfig;
  beneficiaries: Beneficiary[];
  userAddress: string;
}

export function PostDeploymentActions({
  deploymentResult,
  tokenConfig,
  beneficiaries,
  userAddress,
}: PostDeploymentActionsProps) {
  const [showFundDialog, setShowFundDialog] = useState(false);

  // ✅ KEEP TOKEN AMOUNTS AS-IS (NO WEI CONVERSION)
  const vestingContracts = deploymentResult.vestingContracts.map(
    (address, index) => {
      const beneficiary = beneficiaries[index];
      const tokenAmount = parseFloat(beneficiary?.amount || "0");

      return {
        address,
        beneficiary: beneficiary?.address || "Unknown",
        totalAmount: tokenAmount, // Keep as token amount
      };
    }
  );

  const totalAmountToFund = beneficiaries.reduce(
    (sum, b) => sum + parseFloat(b.amount || "0"),
    0
  );

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          ✅ Token and vesting contracts deployed successfully!
        </AlertDescription>
      </Alert>

      {/* Important Next Step */}
      <Alert variant="default" className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Important: Fund Vesting Contracts</p>
            <p>
              Your vesting contracts have been created but need to be funded
              with {tokenConfig.symbol} tokens before beneficiaries can claim.
              This is a required step.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Single Action - Fund Contracts */}
      <Card>
        <CardHeader>
          <CardTitle>Required Action</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setShowFundDialog(true)}
            className="w-full"
            size="lg"
          >
            Fund All Vesting Contracts
          </Button>
        </CardContent>
      </Card>

      {/* Deployment Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Token:</span>
              <span className="font-medium">
                {tokenConfig.name} ({tokenConfig.symbol})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Token Address:</span>
              <span className="font-mono text-xs">
                {deploymentResult.tokenAddress}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Vesting Contracts:</span>
              <span>{deploymentResult.vestingContracts.length} created</span>
            </div>
            <div className="flex justify-between">
              <span>Total Beneficiaries:</span>
              <span>{beneficiaries.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Amount to Fund:</span>
              <span className="font-medium">
                {totalAmountToFund.toLocaleString()} {tokenConfig.symbol}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Funding Dialog */}
      <BulkFundingDialog
        open={showFundDialog}
        onOpenChange={setShowFundDialog}
        tokenAddress={deploymentResult.tokenAddress}
        tokenSymbol={tokenConfig.symbol}
        vestingContracts={vestingContracts}
        userAddress={userAddress}
      />
    </div>
  );
}
