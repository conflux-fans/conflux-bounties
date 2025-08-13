// src/components/analytics/analytics-overview.tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUserData } from "@/lib/hooks/use-token-data";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  Clock,
  BarChart3,
} from "lucide-react";

export function AnalyticsOverview() {
  const { data: userData, isLoading } = useUserData();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!userData) {
    return null;
  }

  const { stats, deployedTokens, vestingSchedules } = userData;

  // Calculate additional metrics
  const totalValue = deployedTokens.reduce(
    (sum: number, token: any) => sum + parseFloat(token.totalSupply),
    0
  );

  const claimRate =
    stats.totalTokensVested > 0
      ? (stats.totalTokensClaimed / stats.totalTokensVested) * 100
      : 0;

  const activeTokens = deployedTokens.filter((token: any) =>
    token.vestingSchedules.some((schedule: any) => !schedule.revoked)
  ).length;

  const overviewStats = [
    {
      title: "Total Tokens Deployed",
      value: stats.tokensDeployed.toString(),
      change: "+12% from last month",
      icon: Coins,
      color: "text-blue-500",
      trend: "up" as const,
    },
    {
      title: "Active Beneficiaries",
      value: stats.totalBeneficiaries.toString(),
      change: "+8% from last month",
      icon: Users,
      color: "text-green-500",
      trend: "up" as const,
    },
    {
      title: "Claim Rate",
      value: `${claimRate.toFixed(1)}%`,
      change: "+2.4% from last month",
      icon: TrendingUp,
      color: "text-purple-500",
      trend: "down" as const,
    },
    {
      title: "Active Tokens",
      value: activeTokens.toString(),
      change: "No change",
      icon: Clock,
      color: "text-orange-500",
      trend: "neutral" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {overviewStats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stat.trend === "up" && (
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              )}
              {stat.trend === "down" && (
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
              )}
              {stat.trend === "neutral" && (
                <BarChart3 className="h-3 w-3 mr-1 text-gray-500" />
              )}
              {stat.change}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
