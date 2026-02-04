import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { useDailyActivity } from '../../api/hooks';
import { ChartTypeSwitcher, type ChartType } from '../common/ChartTypeSwitcher';

const COLOR = '#3B82F6';

/** Active accounts chart with switchable chart type. */
export function ActiveAccountsChart() {
  const { data, isLoading } = useDailyActivity();
  const [chartType, setChartType] = useState<ChartType>('bar');

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const rows = (data?.data ?? []).slice().reverse();

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
    formatter: (v: number) => [v.toLocaleString(), 'Active Accounts'] as [string, string],
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-secondary uppercase tracking-wider">Active Accounts</div>
        <ChartTypeSwitcher value={chartType} onChange={setChartType} />
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={rows} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="active_accounts" fill={COLOR} radius={[4, 4, 0, 0]} barSize={8} opacity={0.85} />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={rows} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Line type="monotone" dataKey="active_accounts" stroke={COLOR} strokeWidth={2.5} dot={false} />
            </LineChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="accountsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Area type="monotone" dataKey="active_accounts" stroke={COLOR} fill="url(#accountsGrad)" strokeWidth={2.5} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
