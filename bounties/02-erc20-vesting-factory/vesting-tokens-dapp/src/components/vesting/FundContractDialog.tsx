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
  const { shortfall, totalAmount, balance } = useVestingContractBalance(
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
  const currentBalanceTokens = balance
    ? parseFloat(formatEther(balance as bigint))
    : 0;

  // ✅ CALCULATE REMAINING AMOUNT NEEDED (what's still needed to fully fund)
  const remainingAmount = Math.max(0, totalAmountTokens - currentBalanceTokens);

  // ✅ MAX AMOUNT USER CAN SEND (capped by user balance and remaining needed)
  const maxSendAmount = Math.min(userBalanceTokens, remainingAmount);

  // ✅ AUTO-FILL TO SHORTFALL ONLY (remaining amount needed)
  useEffect(() => {
    if (open && remainingAmount > 0) {
      // Auto-fill to the minimum of what's needed and what user has
      setAmount(maxSendAmount.toString());
    }
  }, [open, remainingAmount, maxSendAmount]);

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

    // ✅ VALIDATE AGAINST REMAINING AMOUNT
    if (amountFloat > remainingAmount) {
      toast({
        title: "Amount Exceeds Remaining",
        description: `Contract only needs ${remainingAmount.toLocaleString()} ${tokenSymbol} more`,
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
                  <strong>Total Required:</strong> {totalAmountTokens.toLocaleString()} {tokenSymbol}
                </div>
                <div>
                  <strong>Current Balance:</strong> {currentBalanceTokens.toLocaleString()} {tokenSymbol}
                </div>
                <div className="text-orange-600 dark:text-orange-400">
                  <strong>Remaining Needed:</strong> {remainingAmount.toLocaleString()} {tokenSymbol}
                </div>
                <div className="pt-1 border-t mt-2">
                  <strong>Your Balance:</strong> {userBalanceTokens.toLocaleString()} {tokenSymbol}
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
                max={maxSendAmount}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(maxSendAmount.toString())}
                disabled={maxSendAmount <= 0}
                title={`Max: ${maxSendAmount.toLocaleString()} ${tokenSymbol}`}
              >
                Max
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum you can send: {maxSendAmount.toLocaleString()} {tokenSymbol}
            </p>
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

          {/* ✅ DESTRUCTIVE ALERT IF EXCEEDING REMAINING */}
          {parseFloat(amount) > remainingAmount && parseFloat(amount) <= userBalanceTokens && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Amount exceeds what's needed. Contract only needs{" "}
                {remainingAmount.toLocaleString()} {tokenSymbol} more to be fully funded.
              </AlertDescription>
            </Alert>
          )}

          {/* Success indicator when fully funded */}
          {remainingAmount === 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <Info className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                ✓ Contract is fully funded! No additional funding needed.
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
