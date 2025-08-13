// app/src/components/vesting/FundContractDialog.tsx (UPDATED)
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useSendTokensToVesting,
  useUserTokenBalance,
  useVestingContractBalance,
} from "@/lib/hooks/useTokenFunding";
import { parseEther, formatEther } from "viem";
import { Loader2, AlertTriangle, Info } from "lucide-react";

interface FundContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenAddress: string;
  vestingContractAddress: string;
  tokenSymbol: string;
  userAddress: string;
}

export function FundContractDialog({
  open,
  onOpenChange,
  tokenAddress,
  vestingContractAddress,
  tokenSymbol,
  userAddress,
}: FundContractDialogProps) {
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

  const { data: userBalance } = useUserTokenBalance(tokenAddress, userAddress);
  const { shortfall, totalAmount } = useVestingContractBalance(
    tokenAddress,
    vestingContractAddress
  );
  const { sendTokens, isLoading, isSuccess, error } = useSendTokensToVesting();

  // ✅ CONVERT WEI VALUES TO TOKEN AMOUNTS FOR DISPLAY
  const userBalanceTokens = userBalance
    ? parseFloat(formatEther(userBalance as bigint))
    : 0;
  const shortfallTokens = shortfall ? parseFloat(formatEther(shortfall)) : 0;
  const totalAmountTokens = totalAmount
    ? parseFloat(formatEther(totalAmount))
    : 0;

  // Auto-fill recommended amount
  useEffect(() => {
    if (shortfallTokens > 0) {
      setAmount(shortfallTokens.toString());
    }
  }, [shortfallTokens]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Tokens Sent Successfully",
        description: `${amount} ${tokenSymbol} sent to vesting contract`,
      });
      onOpenChange(false);
      setAmount("");
    }
  }, [isSuccess, amount, tokenSymbol, toast, onOpenChange]);

  // Handle error
  useEffect(() => {
    if (error) {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to send tokens",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleSend = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    const amountFloat = parseFloat(amount);

    if (amountFloat > userBalanceTokens) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough tokens",
        variant: "destructive",
      });
      return;
    }

    try {
      // ✅ CONVERT TOKEN AMOUNT TO WEI ONLY FOR BLOCKCHAIN TRANSACTION
      const amountWei = parseEther(amount);
      await sendTokens(tokenAddress, vestingContractAddress, amountWei);
    } catch (err) {
      console.error("Send tokens error:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Vesting Contract</DialogTitle>
          <DialogDescription>
            Send {tokenSymbol} tokens to the vesting contract so beneficiaries
            can claim their tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <div>
                  Required: {totalAmountTokens.toLocaleString()} {tokenSymbol}
                </div>
                <div>
                  Your Balance: {userBalanceTokens.toLocaleString()}{" "}
                  {tokenSymbol}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Send</Label>
            <div className="flex space-x-2">
              <Input
                id="amount"
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
                step="0.000001"
                min="0"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(totalAmountTokens.toString())}
                disabled={userBalanceTokens <= 0}
              >
                Max
              </Button>
            </div>
          </div>

          {/* Warnings */}
          {parseFloat(amount) > userBalanceTokens && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Insufficient balance. You only have{" "}
                {userBalanceTokens.toLocaleString()} {tokenSymbol}.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Tokens
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
