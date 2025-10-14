// src/components/dashboard/analytics.tsx
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
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Calendar } from "lucide-react";
import { weiToTokens } from "@/lib/utils/tokenUtils";

export function Analytics() {
  const { data: userData, isLoading } = useUserData();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!userData?.deployedTokens?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Deploy tokens to see analytics</CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No data available yet</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for charts
  const { deployedTokens, vestingSchedules } = userData;

  // Monthly deployment data
  const monthlyData = deployedTokens.reduce((acc: any, token: any) => {
    const month = new Date(token.deployedAt).toISOString().slice(0, 7); // YYYY-MM format
    if (!acc[month]) {
      acc[month] = { month, tokens: 0, beneficiaries: 0 };
    }
    acc[month].tokens += 1;
    acc[month].beneficiaries += token.vestingSchedules.length;
    return acc;
  }, {});

  const monthlyChartData = Object.values(monthlyData).sort((a: any, b: any) =>
    a.month.localeCompare(b.month)
  );

  // Category distribution
  const categoryData = vestingSchedules.reduce((acc: any, schedule: any) => {
    const category = schedule.category || "Unknown";
    if (!acc[category]) {
      acc[category] = { name: category, value: 0, count: 0 };
    }
    acc[category].value += parseFloat(schedule.totalAmount);
    acc[category].count += 1;
    return acc;
  }, {});

  const categoryChartData = Object.values(categoryData);

  // Token status distribution
  const statusData = deployedTokens.reduce((acc: any, token: any) => {
    const activeSchedules = token.vestingSchedules.filter((schedule: any) => {
      const now = new Date();
      // Parse startTime in "YYYY-MM-DD HH:mm:ss.SSS" format
      const startTime = new Date(schedule.startTime.replace(" ", "T"));
      const endTime = new Date(
        startTime.getTime() + schedule.vestingDuration * 1000
      );
      return endTime > now && !schedule.revoked;
    }).length;

    const status =
      activeSchedules > 0
        ? "Active"
        : token.vestingSchedules.some((s: any) => s.revoked)
        ? "Paused"
        : "Completed";

    if (!acc[status]) {
      acc[status] = { name: status, value: 0 };
    }
    acc[status].value += 1;
    return acc;
  }, {});

  const statusChartData = Object.values(statusData);

  // Claim activity over time (last 6 months)
  const claimActivity = vestingSchedules
    .flatMap(
      (schedule: any) =>
        schedule.claims?.map((claim: any) => ({
          date: new Date(claim.claimedAt).toISOString().slice(0, 10), // YYYY-MM-DD
          amount: parseFloat(claim.amountClaimed),
          token: schedule.token.symbol,
        })) || []
    )
    .reduce((acc: any, claim: any) => {
      if (!acc[claim.date]) {
        acc[claim.date] = { date: claim.date, totalClaimed: 0, claimCount: 0 };
      }
      acc[claim.date].totalClaimed += claim.amount;
      acc[claim.date].claimCount += 1;
      return acc;
    }, {});

  const claimChartData = Object.values(claimActivity)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .slice(-30); // Last 30 days

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analytics Overview
          </CardTitle>
          <CardDescription>
            Insights into your token deployment and vesting performance
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Monthly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Deployment Trends</CardTitle>
            <CardDescription>
              Tokens deployed and beneficiaries added over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Tokens Deployed"
                  />
                  <Area
                    type="monotone"
                    dataKey="beneficiaries"
                    stackId="2"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                    name="Beneficiaries Added"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Token Status Distribution</CardTitle>
            <CardDescription>
              Current status of your deployed tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusChartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category and Claim Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vesting Categories</CardTitle>
            <CardDescription>
              Token allocation by beneficiary category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Tokens",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Claim Activity</CardTitle>
            <CardDescription>
              Token claims over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={claimChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Tokens Claimed",
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalClaimed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Tokens Claimed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Performance Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {(
                  (vestingSchedules.reduce(
                    (sum: number, s: any) =>
                      sum + weiToTokens(s.releasedAmount || "0"),
                    0
                  ) /
                    vestingSchedules.reduce(
                      (sum: number, s: any) => sum + parseFloat(s.totalAmount),
                      0
                    )) *
                  100
                ).toFixed(1)}
                %
              </div>
              <div className="text-sm text-muted-foreground">
                Average Claim Rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {
                  vestingSchedules.filter((s: any) => {
                    const now = new Date();
                    const startTime = new Date(s.startTime.replace(" ", "T"));
                    const endTime = new Date(
                      startTime.getTime() + s.vestingDuration * 1000
                    );
                    return endTime > now && !s.revoked;
                  }).length
                }
              </div>
              <div className="text-sm text-muted-foreground">
                Active Vesting Schedules
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {vestingSchedules.reduce(
                  (sum: number, s: any) => sum + (s.claims?.length || 0),
                  0
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Claims Made
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
