// src/components/charts/vesting-progress-chart.tsx
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { calculateVestingProgress } from "@/lib/web3/utils";
interface VestingProgressChartProps {
  data: any[];
}

export function VestingProgressChart({ data }: VestingProgressChartProps) {
  const chartData = data.map((schedule, index) => {
    const progress = calculateVestingProgress(
      new Date(schedule.startTime).getTime() / 1000,
      schedule.cliffDuration,
      schedule.vestingDuration
    );

    const totalAmount = parseFloat(schedule.totalAmount);
    const releasedAmount = parseFloat(schedule.releasedAmount || "0");
    const vestedAmount = (totalAmount * progress.progressPercentage) / 100;
    const remainingAmount = totalAmount - vestedAmount;

    return {
      name: `${schedule.token.symbol} (${schedule.category})`,
      vested: vestedAmount,
      claimed: releasedAmount,
      remaining: remainingAmount,
      total: totalAmount,
    };
  });

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={150} />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), ""]}
            labelFormatter={(label) => `Token: ${label}`}
          />
          <Legend />
          <Bar dataKey="claimed" stackId="a" fill="#22c55e" name="Claimed" />
          <Bar
            dataKey="vested"
            stackId="a"
            fill="#3b82f6"
            name="Vested (Unclaimed)"
          />
          <Bar
            dataKey="remaining"
            stackId="a"
            fill="#e5e7eb"
            name="Not Yet Vested"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
