// app/src/components/dashboard/AdminTokenManagement.tsx (TABLE VERSION)
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccount, useChainId } from "wagmi";
import { useUserData } from "@/lib/hooks/use-token-data";
import { useVestingContractBalance } from "@/lib/hooks/useTokenFunding";
import { BulkFundingDialog } from "../vesting/BulkFundingDialog";
import { FundContractDialog } from "../vesting/FundContractDialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users,
  ExternalLink,
  Settings,
} from "lucide-react";
import { formatEther } from "viem";
import { getExplorerAddressUrl } from "@/lib/web3/config";

export function AdminTokenManagement() {
  const [showBulkFunding, setShowBulkFunding] = useState(false);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const { address } = useAccount();
  const { data: userData, isLoading } = useUserData();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const ownedTokens =
    userData?.deployedTokens?.filter(
      (token: any) =>
        token.ownerAddress.toLowerCase() === address?.toLowerCase()
    ) || [];

  if (ownedTokens.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No tokens to manage</p>
          <p className="text-sm text-muted-foreground">
            Deploy a token to access management features
          </p>
        </CardContent>
      </Card>
    );
  }

  // Flatten all vesting contracts from all tokens
  const allVestingContracts = ownedTokens.flatMap((token: any) =>
    (token.vestingSchedules || []).map((schedule: any) => ({
      ...schedule,
      tokenName: token.name,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
    }))
  );

  // Get funding status for all contracts
  const contractsWithStatus = allVestingContracts.map((contract: any) => {
    const { hassufficientBalance, shortfall } = useVestingContractBalance(
      contract.tokenAddress,
      contract.contractAddress
    );
    return {
      ...contract,
      hassufficientBalance,
      shortfall,
    };
  });

  const unfundedContracts = contractsWithStatus.filter(
    (c: { hassufficientBalance: any }) => !c.hassufficientBalance
  );
  const totalUnfunded = unfundedContracts.length;
  const totalShortfall = contractsWithStatus.reduce(
    (sum: any, contract: { shortfall: any }) =>
      sum + (contract.shortfall || 0n),
    0n
  );

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
    const unfundedAddresses = unfundedContracts.map(
      (c: { contractAddress: any }) => c.contractAddress
    );
    setSelectedContracts(unfundedAddresses);
  };

  const handleClearSelection = () => {
    setSelectedContracts([]);
  };

  const handleFundSelected = () => {
    if (selectedContracts.length === 0) return;

    // For bulk funding, we need to group by token
    const groupedByToken = selectedContracts.reduce(
      (acc: any, contractAddress) => {
        const contract = contractsWithStatus.find(
          (c: { contractAddress: string }) =>
            c.contractAddress === contractAddress
        );
        if (!contract) return acc;

        const tokenAddress = contract.tokenAddress;
        if (!acc[tokenAddress]) {
          acc[tokenAddress] = {
            tokenAddress,
            tokenSymbol: contract.tokenSymbol,
            contracts: [],
          };
        }

        acc[tokenAddress].contracts.push({
          address: contractAddress,
          beneficiary: contract.beneficiaryAddress,
          totalAmount: parseFloat(contract.totalAmount), // Convert to token amount
        });

        return acc;
      },
      {}
    );

    // For simplicity, fund the first token's contracts
    const firstToken = Object.values(groupedByToken)[0] as any;
    if (firstToken) {
      setSelectedToken(firstToken.tokenAddress);
      setShowBulkFunding(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Token Management Dashboard
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Manage funding and vesting for your deployed tokens
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-2xl font-bold">{ownedTokens.length}</div>
              <div className="text-sm text-muted-foreground">
                Tokens Deployed
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-2xl font-bold">
                {allVestingContracts.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Vesting Contracts
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {totalUnfunded}
              </div>
              <div className="text-sm text-muted-foreground">Need Funding</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {allVestingContracts.length - totalUnfunded}
              </div>
              <div className="text-sm text-muted-foreground">Fully Funded</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {totalUnfunded > 0 && (
                <>
                  <Button onClick={handleSelectAll} variant="outline" size="sm">
                    Select All Unfunded ({totalUnfunded})
                  </Button>
                  {selectedContracts.length > 0 && (
                    <Button
                      onClick={handleClearSelection}
                      variant="ghost"
                      size="sm"
                    >
                      Clear Selection
                    </Button>
                  )}
                </>
              )}
            </div>

            {selectedContracts.length > 0 && (
              <Button onClick={handleFundSelected} size="lg">
                Fund Selected ({selectedContracts.length})
              </Button>
            )}

            {totalUnfunded === 0 && (
              <Alert className="border-green-200 bg-green-50 flex-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ✅ All vesting contracts are properly funded
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vesting Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vesting Contracts ({allVestingContracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedContracts.length === unfundedContracts.length &&
                      unfundedContracts.length > 0
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleSelectAll();
                      } else {
                        handleClearSelection();
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Beneficiary</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shortfall</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsWithStatus.map((contract: any) => (
                <VestingContractTableRow
                  key={contract.contractAddress}
                  contract={contract}
                  isSelected={selectedContracts.includes(
                    contract.contractAddress
                  )}
                  onSelect={(checked) =>
                    handleSelectContract(contract.contractAddress, checked)
                  }
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Funding Dialog */}
      {selectedToken && (
        <BulkFundingDialog
          open={showBulkFunding}
          onOpenChange={setShowBulkFunding}
          tokenAddress={selectedToken}
          tokenSymbol={
            ownedTokens.find((t: any) => t.address === selectedToken)?.symbol ||
            "TOKEN"
          }
          vestingContracts={
            selectedContracts
              .map((contractAddr) => {
                const contract = contractsWithStatus.find(
                  (c: { contractAddress: string }) =>
                    c.contractAddress === contractAddr
                );
                return contract
                  ? {
                      address: contractAddr,
                      beneficiary: contract.beneficiaryAddress,
                      totalAmount: parseFloat(contract.totalAmount), // Token amount
                    }
                  : null;
              })
              .filter(Boolean) as any[]
          }
          userAddress={address!}
        />
      )}
    </div>
  );
}

function VestingContractTableRow({
  contract,
  isSelected,
  onSelect,
}: {
  contract: any;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const chainId = useChainId();
  const [showFundDialog, setShowFundDialog] = useState(false);
  const { address } = useAccount();

  const canSelect = !contract.hassufficientBalance;
  const shortfallTokens = contract.shortfall
    ? parseFloat(formatEther(contract.shortfall))
    : 0;

  return (
    <>
      <TableRow className={isSelected ? "bg-muted/50" : ""}>
        <TableCell>
          <Checkbox
            checked={isSelected}
            disabled={!canSelect}
            onCheckedChange={onSelect}
          />
        </TableCell>

        <TableCell>
          <div>
            <div className="font-medium">{contract.tokenName}</div>
            <div className="text-sm text-muted-foreground">
              ({contract.tokenSymbol})
            </div>
          </div>
        </TableCell>

        <TableCell>
          <div className="font-mono text-sm">
            {contract.beneficiaryAddress.slice(0, 8)}...
            {contract.beneficiaryAddress.slice(-6)}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              {contract.contractAddress.slice(0, 8)}...
              {contract.contractAddress.slice(-6)}
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
              <a
                href={getExplorerAddressUrl(chainId, contract.contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </TableCell>

        <TableCell>
          <div className="font-medium">
            {parseFloat(contract.totalAmount).toLocaleString()}{" "}
            {contract.tokenSymbol}
          </div>
        </TableCell>

        <TableCell>
          {contract.hassufficientBalance ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Funded
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Needs Funding
            </Badge>
          )}
        </TableCell>

        <TableCell>
          {shortfallTokens > 0 ? (
            <span className="text-red-600 font-medium">
              {shortfallTokens.toLocaleString()} {contract.tokenSymbol}
            </span>
          ) : (
            <span className="text-green-600">-</span>
          )}
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            {!contract.hassufficientBalance && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFundDialog(true)}
              >
                Fund
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Individual Fund Dialog */}
      {address && (
        <FundContractDialog
          open={showFundDialog}
          onOpenChange={setShowFundDialog}
          tokenAddress={contract.tokenAddress}
          vestingContractAddress={contract.contractAddress}
          tokenSymbol={contract.tokenSymbol}
          userAddress={address}
        />
      )}
    </>
  );
}
