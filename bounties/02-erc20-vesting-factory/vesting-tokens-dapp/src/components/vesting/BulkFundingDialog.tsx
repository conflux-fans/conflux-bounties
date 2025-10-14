// app/src/components/vesting/BulkFundingDialog.tsx (UPDATED)
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useVestingContractBalance,
  useSendTokensToVesting,
} from "@/lib/hooks/useTokenFunding";
import { parseEther } from "viem";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface VestingContract {
  address: string;
  beneficiary: string;
  totalAmount: number; // ✅ TOKEN AMOUNT (not Wei)
}

interface BulkFundingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenAddress: string;
  tokenSymbol: string;
  vestingContracts: VestingContract[];
  userAddress: string;
}

export function BulkFundingDialog({
  open,
  onOpenChange,
  tokenAddress,
  tokenSymbol,
  vestingContracts,
  userAddress,
}: BulkFundingDialogProps) {
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [fundingStates, setFundingStates] = useState<
    Record<string, "pending" | "success" | "error">
  >({});
  const { sendTokens, isLoading } = useSendTokensToVesting();
  const { toast } = useToast();

  // ✅ MOVE HOOKS TO TOP LEVEL - call useVestingContractBalance for all contracts
  const contractBalances = vestingContracts.map(contract => 
    useVestingContractBalance(tokenAddress, contract.address)
  );

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedContracts([]);
      setFundingStates({});
    }
  }, [open]);

  const handleSelectContract = (contractAddress: string, checked: boolean) => {
    if (checked) {
      setSelectedContracts((prev) => [...prev, contractAddress]);
    } else {
      setSelectedContracts((prev) =>
        prev.filter((addr) => addr !== contractAddress)
      );
    }
  };

  const handleSelectAll = () => {
    const unfundedAddresses = vestingContracts
      .filter((contract, index) => {
        const { hassufficientBalance } = contractBalances[index];
        return !hassufficientBalance;
      })
      .map((c) => c.address);

    setSelectedContracts(unfundedAddresses);
  };

  const handleFundSelected = async () => {
    let successCount = 0;
    let errorCount = 0;

    for (const contractAddress of selectedContracts) {
      const contract = vestingContracts.find(
        (c) => c.address === contractAddress
      );
      if (!contract) continue;

      try {
        setFundingStates((prev) => ({ ...prev, [contractAddress]: "pending" }));

        // ✅ CONVERT TOKEN AMOUNT TO WEI ONLY FOR BLOCKCHAIN TRANSACTION
        const amountInWei = parseEther(contract.totalAmount.toString());
        await sendTokens(tokenAddress, contractAddress, amountInWei);

        setFundingStates((prev) => ({ ...prev, [contractAddress]: "success" }));
        successCount++;
      } catch (error) {
        console.error(`Failed to fund contract ${contractAddress}:`, error);
        setFundingStates((prev) => ({ ...prev, [contractAddress]: "error" }));
        errorCount++;
      }
    }

    // Show summary toast
    if (successCount > 0) {
      toast({
        title: "Funding Complete",
        description: `Successfully funded ${successCount} contracts${
          errorCount > 0 ? `, ${errorCount} failed` : ""
        }`,
      });
    }

    if (errorCount === selectedContracts.length) {
      toast({
        title: "Funding Failed",
        description: "All funding transactions failed. Please try again.",
        variant: "destructive",
      });
    }
  };

  // ✅ CALCULATE TOTAL IN TOKEN AMOUNTS
  const totalAmount = selectedContracts.reduce((sum, contractAddress) => {
    const contract = vestingContracts.find(
      (c) => c.address === contractAddress
    );
    return sum + (contract ? Number(contract.totalAmount) : 0);
  }, 0);

  const unfundedContracts = vestingContracts.filter((contract, index) => {
    const { hassufficientBalance } = contractBalances[index];
    return !hassufficientBalance;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fund Vesting Contracts</DialogTitle>
          <DialogDescription>
            Select vesting contracts to fund with {tokenSymbol} tokens.
          </DialogDescription>
        </DialogHeader>

        {unfundedContracts.length === 0 ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ All vesting contracts are already funded!
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Select All Button */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {unfundedContracts.length} contracts need funding
              </span>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All Unfunded
              </Button>
            </div>

            {/* Contracts List */}
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {vestingContracts.map((contract, index) => (
                  <VestingContractItem
                    key={contract.address}
                    contract={contract}
                    tokenAddress={tokenAddress}
                    tokenSymbol={tokenSymbol}
                    onSelect={handleSelectContract}
                    isSelected={selectedContracts.includes(contract.address)}
                    fundingState={fundingStates[contract.address]}
                    balanceData={contractBalances[index]}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Fund Button */}
            {selectedContracts.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="font-medium">
                      {/* ✅ DISPLAY TOKEN AMOUNT DIRECTLY */}
                      Total: {totalAmount.toLocaleString()} {tokenSymbol}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      For {selectedContracts.length} contracts
                    </div>
                  </div>
                  <Button
                    onClick={handleFundSelected}
                    disabled={isLoading || selectedContracts.length === 0}
                    size="lg"
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isLoading
                      ? "Funding..."
                      : `Fund ${selectedContracts.length} Contracts`}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VestingContractItem({
  contract,
  tokenAddress,
  tokenSymbol,
  onSelect,
  isSelected,
  fundingState,
  balanceData,
}: {
  contract: VestingContract;
  tokenAddress: string;
  tokenSymbol: string;
  onSelect: (address: string, checked: boolean) => void;
  isSelected: boolean;
  fundingState?: "pending" | "success" | "error";
  balanceData: ReturnType<typeof useVestingContractBalance>;
}) {
  const { hassufficientBalance, isLoading } = balanceData;

  const getStatusIcon = () => {
    if (fundingState === "pending")
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (fundingState === "success")
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (fundingState === "error")
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (hassufficientBalance)
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  };

  const getStatusText = () => {
    if (fundingState === "pending") return "Funding...";
    if (fundingState === "success") return "Funded ✓";
    if (fundingState === "error") return "Failed ✗";
    if (hassufficientBalance) return "Already Funded";
    return "Needs Funding";
  };

  const isDisabled =
    hassufficientBalance || fundingState === "success" || isLoading;

  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg">
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(contract.address, !!checked)}
        disabled={isDisabled}
      />
      <div className="flex-1">
        <div className="font-medium">
          {contract.beneficiary.slice(0, 10)}...{contract.beneficiary.slice(-8)}
        </div>
        <div className="text-sm text-muted-foreground">
          {contract.address.slice(0, 10)}...{contract.address.slice(-8)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium">
          {/* ✅ DISPLAY TOKEN AMOUNT DIRECTLY */}
          {contract.totalAmount.toLocaleString()} {tokenSymbol}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          {getStatusIcon()}
          {getStatusText()}
        </div>
      </div>
    </div>
  );
}
