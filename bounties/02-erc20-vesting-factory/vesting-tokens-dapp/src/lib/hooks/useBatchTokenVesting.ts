// src/lib/hooks/useBatchTokenVesting.ts
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useAccount,
} from "wagmi";
import {
  TOKEN_VESTING_FACTORY_ABI,
} from "@/lib/web3/config";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/lib/hooks/use-toast";
import { formatEther, parseEventLogs } from "viem";
import {
  BatchTokenConfig,
  BatchVestingSchedule,
  BatchBeneficiary,
  BatchDeploymentResult,
} from "@/store/batch-deployment-store";
import { useFactoryAddress } from "@/lib/hooks/use-factory-address";

export interface TokenConfigForContract {
  name: string;
  symbol: string;
  totalSupply: bigint;
  owner: string;
}

export interface VestingConfigForContract {
  beneficiary: string;
  amount: bigint;
  cliff: bigint;
  duration: bigint;
  revocable: boolean;
}

// Hook for batch deploying tokens with vesting
export function useBatchDeployTokens() {
  const factoryAddress = useFactoryAddress();
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [isParsingResults, setIsParsingResults] = useState(false);
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);

  // Refs for managing deployment state
  const databaseSaveAttempted = useRef(false);
  const currentBatchId = useRef<string | null>(null);
  const deploymentResultRef = useRef<BatchDeploymentResult | null>(null);
  const resolveDeploymentRef = useRef<
    ((result: BatchDeploymentResult) => void) | null
  >(null);
  const rejectDeploymentRef = useRef<((error: Error) => void) | null>(null);

  const publicClient = usePublicClient();
  // const { address } = useAccount();
  const { toast } = useToast();

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isTxSuccess,
    error: waitError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const isDeploying =
    isWritePending || isConfirming || isParsingResults || isSavingToDatabase;

  // Store deployment params for backend save
  const [deploymentParams, setDeploymentParams] = useState<{
    tokenConfigs: BatchTokenConfig[];
    vestingSchedules: BatchVestingSchedule[];
    beneficiaries: BatchBeneficiary[];
    ownerAddress: string;
  } | null>(null);

  // Update progress based on deployment state
  useEffect(() => {
    if (isWritePending) {
      setDeploymentProgress(20);
    } else if (isConfirming) {
      setDeploymentProgress(50);
    } else if (isParsingResults) {
      setDeploymentProgress(75);
    } else if (isSavingToDatabase) {
      setDeploymentProgress(90);
    }
  }, [isWritePending, isConfirming, isParsingResults, isSavingToDatabase]);

  // Handle transaction success
  useEffect(() => {
    if (
      isTxSuccess &&
      hash &&
      deploymentParams &&
      !databaseSaveAttempted.current
    ) {
      handleSuccessfulDeployment();
    }
  }, [isTxSuccess, hash, deploymentParams]);

  // Handle contract errors
  useEffect(() => {
    if (writeError) {
      const errorMessage = writeError.message || "Transaction failed";
      setDeploymentError(errorMessage);
      setDeploymentProgress(0);

      if (rejectDeploymentRef.current) {
        rejectDeploymentRef.current(new Error(errorMessage));
        rejectDeploymentRef.current = null;
        resolveDeploymentRef.current = null;
      }
    }

    if (waitError) {
      const errorMessage =
        waitError.message || "Transaction confirmation failed";
      setDeploymentError(errorMessage);
      setDeploymentProgress(0);

      if (rejectDeploymentRef.current) {
        rejectDeploymentRef.current(new Error(errorMessage));
        rejectDeploymentRef.current = null;
        resolveDeploymentRef.current = null;
      }
    }
  }, [writeError, waitError]);

  const handleSuccessfulDeployment = async () => {
    if (!hash || !deploymentParams || !publicClient) return;

    databaseSaveAttempted.current = true;
    setIsParsingResults(true);

    try {
      // Get transaction receipt to parse events
      const receipt = await publicClient.getTransactionReceipt({ hash });

      // Parse batch deployment events
      const batchEvents = parseEventLogs({
        abi: TOKEN_VESTING_FACTORY_ABI,
        logs: receipt.logs,
        eventName: "BatchDeploymentCompleted",
      });

      if (batchEvents.length === 0) {
        throw new Error("No batch deployment event found in transaction");
      }

      const batchEvent = batchEvents[0];
      const batchId = batchEvent.args.batchId as string;
      const tokens = batchEvent.args.tokens as string[];
      const vestingContracts = batchEvent.args.vestingContracts as string[][];

      currentBatchId.current = batchId;

      // Parse individual token deployment events to get token details
      const tokenEvents = parseEventLogs({
        abi: TOKEN_VESTING_FACTORY_ABI,
        logs: receipt.logs,
        eventName: "TokenDeployed",
      });

      // Create a map of token addresses to their details
      const tokenDetailsMap = new Map();
      tokenEvents.forEach((event) => {
        tokenDetailsMap.set(event.args.token as string, {
          address: event.args.token as string,
          name: event.args.name as string,
          symbol: event.args.symbol as string,
        });
      });

      // Build the result using the batch event data and token details
      const tokensWithDetails = tokens.map((tokenAddress) => {
        const details = tokenDetailsMap.get(tokenAddress);
        return {
          address: tokenAddress,
          name: details?.name || "Unknown",
          symbol: details?.symbol || "UNK",
        };
      });

      const result: BatchDeploymentResult = {
        batchId,
        tokens: tokensWithDetails,
        vestingContracts,
        transactionHash: hash,
        deployedAt: new Date(),
        databaseSaved: false,
      };

      deploymentResultRef.current = result;
      setIsParsingResults(false);
      setIsSavingToDatabase(true);

      // Save to database via API
      try {
        const response = await fetch("/api/batch-deployment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deploymentResult: result,
            tokenConfigs: deploymentParams.tokenConfigs,
            vestingSchedules: deploymentParams.vestingSchedules,
            beneficiaries: deploymentParams.beneficiaries,
            ownerAddress: deploymentParams.ownerAddress,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }

        console.log("Successfully saved batch deployment to database");
        result.databaseSaved = true;
      } catch (dbError) {
        console.error("Database save failed:", dbError);

        toast({
          title: "Deployment successful, database save failed",
          description:
            "Your tokens are deployed but may not appear in dashboard immediately.",
          variant: "destructive",
        });
      } finally {
        setIsSavingToDatabase(false);
      }

      // Update final state
      deploymentResultRef.current = result;
      setDeploymentProgress(100);

      toast({
        title: "Batch deployment successful!",
        description: `Successfully deployed ${result.tokens.length} tokens with vesting contracts.`,
      });

      // Resolve the Promise
      if (resolveDeploymentRef.current) {
        resolveDeploymentRef.current(result);
        resolveDeploymentRef.current = null;
        rejectDeploymentRef.current = null;
      }
    } catch (error) {
      console.error("Error parsing deployment results:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to parse deployment results";
      setDeploymentError(errorMessage);
      setIsParsingResults(false);
      setIsSavingToDatabase(false);

      // Reject the Promise
      if (rejectDeploymentRef.current) {
        rejectDeploymentRef.current(new Error(errorMessage));
        rejectDeploymentRef.current = null;
        resolveDeploymentRef.current = null;
      }
    }
  };

  const deployBatchTokens = async (
    tokenConfigs: BatchTokenConfig[],
    vestingSchedules: BatchVestingSchedule[],
    beneficiaries: BatchBeneficiary[],
    ownerAddress: string
  ): Promise<BatchDeploymentResult> => {
    try {
      // Reset all state
      setDeploymentError(null);
      setDeploymentProgress(0);
      databaseSaveAttempted.current = false;
      currentBatchId.current = null;
      deploymentResultRef.current = null;
      resolveDeploymentRef.current = null;
      rejectDeploymentRef.current = null;
      resetWrite();

      // Store params for later backend save
      setDeploymentParams({
        tokenConfigs: tokenConfigs.map((token) => ({
          ...token,
          totalSupply: formatEther(BigInt(token.totalSupply)), // Convert to string for JSON
        })),
        vestingSchedules,
        beneficiaries,
        ownerAddress,
      });

      // Validate inputs
      if (tokenConfigs.length === 0) {
        throw new Error("At least one token configuration is required");
      }
      if (vestingSchedules.length === 0) {
        throw new Error("At least one vesting schedule is required");
      }
      if (beneficiaries.length === 0) {
        throw new Error("At least one beneficiary is required");
      }

      // Convert to contract format
      const contractTokenConfigs = tokenConfigs.map((token) => {
        return {
          name: token.name,
          symbol: token.symbol,
          totalSupply: BigInt(token.totalSupply), // Remove commas
          owner: ownerAddress as `0x${string}`,
        };
      });

      console.log("contractTokenConfigs:", contractTokenConfigs);

      // Group vesting configurations by token
      const vestingConfigsArray = tokenConfigs.map((token) => {
        const tokenBeneficiaries = beneficiaries.filter(
          (b) => b.tokenId === token.id
        );

        return tokenBeneficiaries.map((beneficiary) => {
          const schedule = vestingSchedules.find(
            (s) => s.tokenId === token.id && s.category === beneficiary.category
          );

          if (!schedule) {
            throw new Error(
              `No vesting schedule found for beneficiary ${beneficiary.address} in category ${beneficiary.category}`
            );
          }

          // Parse beneficiary amount properly to avoid floating point issues
          const amountValue = beneficiary.amount.replace(/,/g, ""); // Remove any commas
          const amountNumber = parseFloat(amountValue);
          const amountWithDecimals =
            BigInt(Math.floor(amountNumber)) * BigInt(10 ** token.decimals);

          return {
            beneficiary: beneficiary.address as `0x${string}`,
            amount: amountWithDecimals,
            cliff: BigInt(schedule.cliffMonths * 30 * 24 * 60 * 60),
            duration: BigInt(schedule.vestingMonths * 30 * 24 * 60 * 60),
            revocable: schedule.revocable,
          };
        });
      });

      // Validate addresses
      tokenConfigs.forEach((token) => {
        const tokenBeneficiaries = beneficiaries.filter(
          (b) => b.tokenId === token.id
        );
        tokenBeneficiaries.forEach((beneficiary, bIndex) => {
          if (!beneficiary.address || !beneficiary.address.startsWith("0x")) {
            throw new Error(
              `Invalid beneficiary address for token ${token.name} at index ${bIndex}`
            );
          }
        });
      });

      console.log("Deploying batch with configs:", {
        tokens: contractTokenConfigs.length,
        totalVestingConfigs: vestingConfigsArray.flat().length,
      });

      // Return a Promise that resolves when deployment is complete
      return new Promise<BatchDeploymentResult>((resolve, reject) => {
        // Store the resolve and reject functions
        resolveDeploymentRef.current = resolve;
        rejectDeploymentRef.current = reject;

        // Set up timeout (5 minutes)
        const timeoutId = setTimeout(() => {
          if (rejectDeploymentRef.current) {
            rejectDeploymentRef.current(
              new Error("Deployment timeout after 5 minutes")
            );
            rejectDeploymentRef.current = null;
            resolveDeploymentRef.current = null;
          }
        }, 5 * 60 * 1000);

        // Clean up timeout when resolved/rejected
        const originalResolve = resolve;
        const originalReject = reject;

        resolveDeploymentRef.current = (result) => {
          clearTimeout(timeoutId);
          originalResolve(result);
        };

        rejectDeploymentRef.current = (error) => {
          clearTimeout(timeoutId);
          originalReject(error);
        };

        // Call the smart contract
        writeContract({
          address: factoryAddress!,
          abi: TOKEN_VESTING_FACTORY_ABI,
          functionName: "batchDeployTokens",
          args: [contractTokenConfigs, vestingConfigsArray],
        });
      });
    } catch (err) {
      console.error("Batch deployment error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown deployment error";
      setDeploymentError(errorMessage);
      throw err;
    }
  };

  const retryDatabaseSave = async (): Promise<boolean> => {
    if (
      !deploymentParams ||
      !currentBatchId.current ||
      !deploymentResultRef.current
    ) {
      setDeploymentError("No deployment data available for retry");
      return false;
    }

    setIsSavingToDatabase(true);
    setDeploymentError(null);

    try {
      const response = await fetch("/api/batch-deployment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deploymentResult: deploymentResultRef.current,
          tokenConfigs: deploymentParams.tokenConfigs,
          vestingSchedules: deploymentParams.vestingSchedules,
          beneficiaries: deploymentParams.beneficiaries,
          ownerAddress: deploymentParams.ownerAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      // Update the result
      deploymentResultRef.current.databaseSaved = true;

      toast({
        title: "Database save successful!",
        description: "Your deployment data has been saved successfully.",
      });

      return true;
    } catch (error) {
      console.error("Retry database save failed:", error);
      setDeploymentError(
        error instanceof Error ? error.message : "Database save failed"
      );
      return false;
    } finally {
      setIsSavingToDatabase(false);
    }
  };

  return {
    deployBatchTokens,
    retryDatabaseSave,
    isDeploying,
    deploymentProgress,
    deploymentError,
    isParsingResults,
    isSavingToDatabase,
    transactionHash: hash,
  };
}
