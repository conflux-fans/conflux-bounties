// src/components/analytics/tokens-list.tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserData } from "@/lib/hooks/use-token-data";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Search,
  Eye,
  ExternalLink,
  Calendar,
  Users,
  Coins,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { shortenAddress } from "@/lib/web3/utils";
import { useChainId } from "wagmi";
import { getExplorerAddressUrl } from "@/lib/web3/config";

export function TokensList() {
  const chainId = useChainId();
  const { data: userData, isLoading } = useUserData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deployedAt");

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!userData?.deployedTokens?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No tokens deployed yet</p>
          <p className="text-sm text-muted-foreground">
            Deploy your first token to see analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  const { deployedTokens } = userData;

  // Enhanced tokens with calculated metrics
  const enhancedTokens = deployedTokens.map((token: any) => {
    const totalBeneficiaries = token.vestingSchedules.length;
    const totalVestedAmount = token.vestingSchedules.reduce(
      (sum: number, schedule: any) => sum + parseFloat(schedule.totalAmount),
      0
    );
    const totalClaimedAmount = token.vestingSchedules.reduce(
      (sum: number, schedule: any) =>
        sum + parseFloat(schedule.releasedAmount || "0"),
      0
    );
    const claimRate =
      totalVestedAmount > 0
        ? (totalClaimedAmount / totalVestedAmount) * 100
        : 0;

    const activeSchedules = token.vestingSchedules.filter((schedule: any) => {
      const now = new Date();
      const endTime = new Date(
        schedule.startTime.getTime() + schedule.vestingDuration * 1000
      );
      return endTime > now && !schedule.revoked;
    }).length;

    const status =
      activeSchedules > 0
        ? "active"
        : token.vestingSchedules.some((s: any) => s.revoked)
        ? "paused"
        : "completed";

    return {
      ...token,
      totalBeneficiaries,
      totalVestedAmount,
      totalClaimedAmount,
      claimRate,
      activeSchedules,
      status,
    };
  });

  // Filter and sort tokens
  const filteredTokens = enhancedTokens
    .filter((token: any) => {
      const matchesSearch =
        token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || token.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "beneficiaries":
          return b.totalBeneficiaries - a.totalBeneficiaries;
        case "vested":
          return b.totalVestedAmount - a.totalVestedAmount;
        case "claimRate":
          return b.claimRate - a.claimRate;
        case "deployedAt":
        default:
          return (
            new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
          );
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Your Deployed Tokens
        </CardTitle>
        <CardDescription>
          Manage and analyze your token deployments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deployedAt">Deploy Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="beneficiaries">Beneficiaries</SelectItem>
              <SelectItem value="vested">Vested Amount</SelectItem>
              <SelectItem value="claimRate">Claim Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Tokens</div>
            <div className="text-2xl font-bold">{enhancedTokens.length}</div>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">
              Total Beneficiaries
            </div>
            <div className="text-2xl font-bold">
              {enhancedTokens.reduce(
                (sum: number, token: any) => sum + token.totalBeneficiaries,
                0
              )}
            </div>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Vested</div>
            <div className="text-2xl font-bold">
              {enhancedTokens
                .reduce(
                  (sum: number, token: any) => sum + token.totalVestedAmount,
                  0
                )
                .toLocaleString()}
            </div>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Avg Claim Rate</div>
            <div className="text-2xl font-bold">
              {(
                enhancedTokens.reduce(
                  (sum: number, token: any) => sum + token.claimRate,
                  0
                ) / enhancedTokens.length
              ).toFixed(1)}
              %
            </div>
          </div>
        </div>

        {/* Tokens Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Beneficiaries</TableHead>
                <TableHead>Vested Amount</TableHead>
                <TableHead>Claim Rate</TableHead>
                <TableHead>Deployed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTokens.map((token: any) => (
                <TableRow key={token.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{token.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {token.symbol} • {shortenAddress(token.address)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(token.status)}>
                      {token.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {token.totalBeneficiaries}
                      {token.activeSchedules > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({token.activeSchedules} active)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {token.totalVestedAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {token.totalClaimedAmount.toLocaleString()} claimed
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, token.claimRate)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {token.claimRate.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(token.deployedAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/analytics/${token.address}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={getExplorerAddressUrl(chainId, token.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredTokens.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No tokens match your search criteria</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
