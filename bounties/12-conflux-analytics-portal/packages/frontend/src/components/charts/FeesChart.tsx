import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { useDailyFees } from '../../api/hooks';
import { ChartTypeSwitcher, type ChartType } from '../common/ChartTypeSwitcher';

const BURNED = '#6366F1';
const TIPS = '#4ADE80';

/** Stacked chart for burned vs tips over time with chart type switcher. */
export function FeesChart() {
  const { data, isLoading } = useDailyFees();
  const [chartType, setChartType] = useState<ChartType>('area');

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const rows = (data?.data ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      date: r.date,
      burned: Number(r.total_burned),
      tips: Number(r.total_tips),
    }));

  const xAxisProps = {
    dataKey: 'date' as const,
    axisLine: false,
    tickLine: false,
    tick: { fill: '#9CA3AF', fontSize: 11 },
    tickFormatter: (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    interval: Math.max(Math.floor(rows.length / 6), 1),
  };

  const tooltipProps = {
    contentStyle: { borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 },
    labelFormatter: (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end mb-2">
        <ChartTypeSwitcher value={chartType} onChange={setChartType} />
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="burnedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BURNED} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={BURNED} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tipsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TIPS} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={TIPS} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Area type="monotone" dataKey="burned" stackId="1" stroke={BURNED} fill="url(#burnedGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="tips" stackId="1" stroke={TIPS} fill="url(#tipsGrad)" strokeWidth={2} />
            </AreaChart>
          ) : chartType === 'bar' ? (
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="burned" stackId="1" fill={BURNED} barSize={8} opacity={0.85} />
              <Bar dataKey="tips" stackId="1" fill={TIPS} radius={[4, 4, 0, 0]} barSize={8} opacity={0.85} />
            </BarChart>
          ) : (
            <LineChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Line type="monotone" dataKey="burned" stroke={BURNED} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="tips" stroke={TIPS} strokeWidth={2.5} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
