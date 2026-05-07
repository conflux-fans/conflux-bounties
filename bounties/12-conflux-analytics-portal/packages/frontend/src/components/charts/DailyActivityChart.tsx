import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { useDailyActivity } from '../../api/hooks';
import { ChartTypeSwitcher, type ChartType } from '../common/ChartTypeSwitcher';

const ACCENT = '#4ADE80';

/** Daily transaction chart with switchable chart type (bar/line/area). */
export function DailyActivityChart() {
  const { data, isLoading } = useDailyActivity();
  const [chartType, setChartType] = useState<ChartType>('bar');

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const rows = (data?.data ?? []).slice().reverse();
  const avg = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.tx_count, 0) / rows.length) : 0;

  const xAxisProps = {
    dataKey: 'date' as const,
    axisLine: false,
    tickLine: false,
    tick: { fill: '#9CA3AF', fontSize: 11 },
    tickFormatter: (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    interval: Math.max(Math.floor(rows.length / 8), 1),
  };

  const tooltipProps = {
    contentStyle: { borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 },
    labelFormatter: (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    formatter: (v: number) => [v.toLocaleString(), 'Transactions'] as [string, string],
  };

  return (
    <div className="w-full h-full relative p-6 pt-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-semibold text-secondary uppercase tracking-wider">Daily Transactions</div>
          <div className="text-lg font-bold">Avg {avg.toLocaleString()}</div>
        </div>
        <ChartTypeSwitcher value={chartType} onChange={setChartType} />
      </div>

      <div className="h-[calc(100%-3.5rem)]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={rows} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="tx_count" fill={ACCENT} radius={[4, 4, 0, 0]} barSize={8} />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={rows} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Line type="monotone" dataKey="tx_count" stroke={ACCENT} strokeWidth={2.5} dot={false} />
            </LineChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
              <XAxis {...xAxisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} />
              <Area type="monotone" dataKey="tx_count" stroke={ACCENT} fill="url(#txGrad)" strokeWidth={2.5} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
