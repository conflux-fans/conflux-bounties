import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, TrendingUp, Activity } from "lucide-react";

interface DataPoint {
  time: string;
  [key: string]: string | number;
}

interface Series {
  dataKey: string;
  color: string;
  label: string;
}

interface TimeSeriesChartProps {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  series: Series[];
  height?: number;
}

type ChartType = "area" | "bar" | "line";

/** Custom tooltip matching the design system */
function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload) return null;
  const items = payload as Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;

  return (
    <div className="bg-white border border-zinc-200 p-3 shadow-sm">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2 font-mono">
        {label as string}
      </p>
      <div className="space-y-1">
        {items.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
            <p className="text-xs font-mono text-zinc-600">
              {entry.dataKey.toUpperCase()}:{" "}
              <span className="font-bold text-zinc-900">{entry.value}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reusable chart with Area/Bar/Line toggle, matching the Conflux Pulse design */
export function TimeSeriesChart({
  title,
  subtitle,
  data,
  series,
  height = 300,
}: TimeSeriesChartProps) {
  const [chartType, setChartType] = useState<ChartType>("area");

  const commonAxisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick: { fill: "#a1a1aa", fontSize: 10, fontFamily: "JetBrains Mono" },
  };

  function renderChart() {
    const commonProps = {
      data,
      margin: { top: 10, right: 10, left: -20, bottom: 0 },
    };

    const gridProps = {
      strokeDasharray: "0 0",
      vertical: false as const,
      horizontal: true as const,
      stroke: "#f4f4f5",
    };

    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="time" {...commonAxisProps} dy={10} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "#f4f4f5" }}
            />
            {series.map((s) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                fill={s.color}
                radius={[0, 0, 0, 0]}
                barSize={8}
              />
            ))}
          </BarChart>
        );
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="time" {...commonAxisProps} dy={10} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "#e4e4e7", strokeWidth: 1 }}
            />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="step"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
              />
            ))}
          </LineChart>
        );
      case "area":
      default:
        return (
          <AreaChart {...commonProps}>
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.dataKey}
                  id={`grad-${s.dataKey}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.05} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="time" {...commonAxisProps} dy={10} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "#e4e4e7", strokeWidth: 1 }}
            />
            {series.map((s) => (
              <Area
                key={s.dataKey}
                type="step"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${s.dataKey})`}
                activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        );
    }
  }

  return (
    <div className="bg-white p-6 border border-zinc-200 h-full flex flex-col transition-all duration-300 hover:border-zinc-300">
      <div className="flex justify-between items-start mb-6">
        {/* Title Section */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-zinc-900" />
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 font-mono pl-4">
              {subtitle}
            </p>
          )}
        </div>

        {/* Controls Section */}
        <div className="flex gap-2">
          {/* Chart Type Selector */}
          <div className="flex border border-zinc-200 bg-zinc-50 p-0.5">
            <button
              onClick={() => setChartType("area")}
              className={`p-1.5 ${
                chartType === "area"
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="Area Chart"
            >
              <Activity size={14} />
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`p-1.5 ${
                chartType === "bar"
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="Bar Chart"
            >
              <BarChart3 size={14} />
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`p-1.5 ${
                chartType === "line"
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="Line Chart"
            >
              <TrendingUp size={14} />
            </button>
          </div>

          {/* Time Selector */}
          <div className="flex border border-zinc-200 bg-zinc-50">
            {["1H", "24H", "7D"].map((opt, i) => (
              <button
                key={opt}
                className={`px-3 py-1 text-[10px] font-bold font-mono ${
                  i === 0
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height }} className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
