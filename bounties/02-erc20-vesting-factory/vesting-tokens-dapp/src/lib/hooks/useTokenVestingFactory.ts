// src/lib/hooks/useTokenVestingFactory.ts - FIXED to prevent double API calls
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useAccount,
} from "wagmi";
import { TOKEN_VESTING_FACTORY_ABI } from "@/lib/web3/config";
import { useState, useEffect, useRef } from "react";
import { formatEther, parseEventLogs } from "viem";
import { useToast } from "@/lib/hooks/use-toast";
import { useFactoryAddress } from "@/lib/hooks/use-factory-address";

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: bigint;
  owner: string;
}

export interface VestingConfig {
  beneficiary: string;
  amount: bigint;
  cliff: bigint;
  duration: bigint;
  revocable: boolean;
}

export interface DeploymentResult {
  tokenAddress: string;
  vestingContracts: string[];
  transactionHash: string;
  deployedAt: Date;
  databaseSaved: boolean;
}

// Hook for deploying token with vesting + backend integration
export function useDeployTokenWithVesting() {
  const factoryAddress = useFactoryAddress();

  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [isParsingAddresses, setIsParsingAddresses] = useState(false);
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);

  // CRITICAL: Use ref to prevent double database saves
  const databaseSaveAttempted = useRef(false);
  const currentTransactionHash = useRef<string | null>(null);

  const publicClient = usePublicClient();
  const { address } = useAccount();
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

  // Store deployment params for backend save
  const [deploymentParams, setDeploymentParams] = useState<{
    tokenConfig: any;
    vestingSchedules: any[];
    beneficiaries: any[];
  } | null>(null);

  // Parse transaction and save to backend when successful
  useEffect(() => {
    async function parseAndSaveDeployment() {
      if (
        isTxSuccess &&
        hash &&
        publicClient &&
        !isParsingAddresses &&
        deploymentParams
      ) {
        // PREVENT DOUBLE EXECUTION - Check if we already processed this transaction
        if (
          databaseSaveAttempted.current &&
          currentTransactionHash.current === hash
        ) {
          console.log(
            "Database save already attempted for this transaction, skipping"
          );
          return;
        }

        try {
          // Mark that we're processing this transaction
          databaseSaveAttempted.current = true;
          currentTransactionHash.current = hash;

          setIsParsingAddresses(true);
          console.log(
            "Transaction successful, parsing contract addresses...",
            hash
          );

          // 1. Get transaction receipt
          const receipt = await publicClient.getTransactionReceipt({ hash });

          // 2. Parse TokenDeployed event
          const tokenEvents = parseEventLogs({
            abi: TOKEN_VESTING_FACTORY_ABI,
            logs: receipt.logs,
            eventName: "TokenDeployed",
          });

          if (tokenEvents.length === 0) {
            throw new Error("No TokenDeployed event found in transaction");
          }

          const tokenAddress = tokenEvents[0].args.token as string;

          // 3. Parse VestingDeployed events to get vesting contract addresses
          const vestingEvents = parseEventLogs({
            abi: TOKEN_VESTING_FACTORY_ABI,
            logs: receipt.logs,
            eventName: "VestingDeployed",
          });

          const vestingContracts = vestingEvents.map(
            (event) => event.args.vestingContract as string
          );

          console.log("Successfully parsed addresses:", {
            tokenAddress,
            vestingContracts,
          });

          const preliminaryResult: DeploymentResult = {
            tokenAddress,
            vestingContracts,
            transactionHash: hash,
            deployedAt: new Date(),
            databaseSaved: false,
          };

          // 4. Save to backend database
          setIsSavingToDatabase(true);

          try {
            console.log("Attempting database save (first time)...");
            const response = await fetch("/api/deployment/save", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userAddress: address,
                tokenAddress,
                transactionHash: hash,
                tokenConfig: deploymentParams.tokenConfig,
                vestingSchedules: deploymentParams.vestingSchedules,
                beneficiaries: deploymentParams.beneficiaries,
                vestingContracts,
              }),
            });

            const saveResult = await response.json();

            if (!response.ok) {
              console.error("Database save failed:", saveResult);
              throw new Error(
                saveResult.details || "Failed to save to database"
              );
            }

            console.log("Successfully saved to database:", saveResult);

            // 5. Set final result with database confirmation
            setDeploymentResult({
              ...preliminaryResult,
              databaseSaved: true,
            });

            toast({
              title: "Deployment Complete",
              description: "Token deployed and data saved successfully!",
            });
          } catch (backendError) {
            console.error("Failed to save to database:", backendError);

            // Still set deployment result, but mark database as failed
            setDeploymentResult({
              ...preliminaryResult,
              databaseSaved: false,
            });

            toast({
              title: "Partial Success",
              description:
                "Token deployed but failed to save to database. You can retry saving later.",
              variant: "destructive",
            });

            // Set specific error for database save failure
            setDeploymentError(
              `Database save failed: ${
                backendError instanceof Error
                  ? backendError.message
                  : "Unknown error"
              }`
            );
          }

          setIsSavingToDatabase(false);
          setIsParsingAddresses(false);
        } catch (error) {
          console.error("Failed to parse deployment addresses:", error);
          setDeploymentError(
            `Failed to parse contract addresses: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          setIsParsingAddresses(false);
          setIsSavingToDatabase(false);

          // Set a fallback result with the transaction hash
          setDeploymentResult({
            tokenAddress: "",
            vestingContracts: [],
            transactionHash: hash,
            deployedAt: new Date(),
            databaseSaved: false,
          });
        }
      }
    }

    parseAndSaveDeployment();
  }, [
    isTxSuccess,
    hash,
    publicClient,
    isParsingAddresses,
    deploymentParams,
    address,
    toast,
  ]);

  // Handle errors
  useEffect(() => {
    if (writeError) {
      console.error("Write contract error:", writeError);
      setDeploymentError(writeError.message || "Transaction failed");
    }
    if (waitError) {
      console.error("Wait for transaction error:", waitError);
      setDeploymentError(
        waitError.message || "Transaction confirmation failed"
      );
    }
  }, [writeError, waitError]);

  const deployToken = async (
    tokenConfig: TokenConfig,
    vestingConfigs: VestingConfig[],
    vestingSchedules: any[], // For backend save
    beneficiaries: any[] // For backend save
  ) => {
    try {
      // Reset previous state AND flags
      setDeploymentResult(null);
      setDeploymentError(null);
      setIsParsingAddresses(false);
      setIsSavingToDatabase(false);

      // RESET the prevention flags for new deployment
      databaseSaveAttempted.current = false;
      currentTransactionHash.current = null;

      resetWrite();

      // Store params for later backend save
      setDeploymentParams({
        tokenConfig: {
          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          totalSupply: formatEther(tokenConfig.totalSupply),
          decimals: 18,
        },
        vestingSchedules,
        beneficiaries,
      });

      // Validate inputs
      if (
        !tokenConfig.name ||
        !tokenConfig.symbol ||
        !tokenConfig.totalSupply
      ) {
        throw new Error("Invalid token configuration");
      }

      if (vestingConfigs.length === 0) {
        throw new Error("At least one vesting configuration is required");
      }

      // Validate addresses
      vestingConfigs.forEach((config, index) => {
        if (!config.beneficiary || !config.beneficiary.startsWith("0x")) {
          throw new Error(`Invalid beneficiary address at index ${index}`);
        }
      });

      console.log("Deploying token with config:", {
        vestingConfigs: vestingConfigs.length,
      });

      await writeContract({
        address: factoryAddress! as `0x${string}`,
        abi: TOKEN_VESTING_FACTORY_ABI,
        functionName: "deployTokenWithVesting",
        args: [
          {
            ...tokenConfig,
            owner: tokenConfig.owner as `0x${string}`,
          },
          vestingConfigs.map((config) => ({
            ...config,
            beneficiary: config.beneficiary as `0x${string}`,
          })),
        ],
      });
    } catch (err) {
      console.error("Deployment error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown deployment error";
      setDeploymentError(errorMessage);
      throw err;
    }
  };

  // Add retry function for database save
  const retryDatabaseSave = async () => {
    if (
      !deploymentResult ||
      !deploymentParams ||
      deploymentResult.databaseSaved
    ) {
      return;
    }

    setIsSavingToDatabase(true);
    try {
      console.log("Retrying database save...");
      const response = await fetch("/api/deployment/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: address,
          tokenAddress: deploymentResult.tokenAddress,
          transactionHash: deploymentResult.transactionHash,
          tokenConfig: deploymentParams.tokenConfig,
          vestingSchedules: deploymentParams.vestingSchedules,
          beneficiaries: deploymentParams.beneficiaries,
          vestingContracts: deploymentResult.vestingContracts,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.details || "Failed to save to database");
      }

      // Update deployment result
      setDeploymentResult({
        ...deploymentResult,
        databaseSaved: true,
      });

      setDeploymentError(null);

      toast({
        title: "Database Save Successful",
        description: "Deployment data has been saved to the database.",
      });
    } catch (error) {
      console.error("Retry database save failed:", error);
      toast({
        title: "Database Save Failed",
        description:
          error instanceof Error ? error.message : "Failed to save to database",
        variant: "destructive",
      });
    } finally {
      setIsSavingToDatabase(false);
    }
  };

  const isLoading =
    isWritePending || isConfirming || isParsingAddresses || isSavingToDatabase;
  const isSuccess = isTxSuccess && deploymentResult?.databaseSaved === true;

  return {
    deployToken,
    deploymentResult,
    deploymentError,
    isLoading,
    isSuccess,
    isParsingAddresses,
    isSavingToDatabase,
    retryDatabaseSave,
    reset: () => {
      setDeploymentResult(null);
      setDeploymentError(null);
      setIsParsingAddresses(false);
      setIsSavingToDatabase(false);
      databaseSaveAttempted.current = false;
      currentTransactionHash.current = null;
      resetWrite();
    },
  };
}
