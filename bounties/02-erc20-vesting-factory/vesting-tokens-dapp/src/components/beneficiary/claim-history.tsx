// src/components/beneficiary/claim-history.tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useUserData } from "@/lib/hooks/use-token-data";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ExternalLink, History } from "lucide-react";
import { shortenAddress } from "@/lib/web3/utils";
import { weiToTokens } from "@/lib/utils/tokenUtils";
import { getExplorerTxUrl } from "@/lib/web3/config";
import { useChainId } from "wagmi";

export function ClaimHistory() {
  const { data: userData, isLoading } = useUserData();
  const chainId = useChainId();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Flatten all claims from all vesting schedules
  const allClaims =
    userData?.vestingSchedules?.flatMap(
      (schedule: any) =>
        schedule.claims?.map((claim: any) => ({
          ...claim,
          token: schedule.token,
          category: schedule.category,
          contractAddress: schedule.contractAddress,
        })) || []
    ) || [];

  // Sort by claim date (most recent first)
  const sortedClaims = allClaims.sort(
    (a: any, b: any) =>
      new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
  );

  if (sortedClaims.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No claims made yet</p>
          <p className="text-sm text-muted-foreground">
            Your token claims will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Claim History
        </CardTitle>
        <CardDescription>
          Your complete token claiming history across all vesting schedules
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Transaction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClaims.map((claim: any) => (
              <TableRow key={claim.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {new Date(claim.claimedAt).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(claim.claimedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{claim.token.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {claim.token.symbol}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{claim.category}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-green-600">
                    +{weiToTokens(claim.amountClaimed).toFixed(2)}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={getExplorerTxUrl(chainId, claim.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <span className="font-mono text-xs">
                        {shortenAddress(claim.txHash)}
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
