import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/Header";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { fetchNodes, fetchMetrics } from "../api/client";

const METRIC_OPTIONS = [
  { value: "rpc_latency", label: "RPC Latency (ms)" },
  { value: "block_height", label: "Block Height" },
  { value: "peer_count", label: "Peer Count" },
  { value: "gas_price_gwei", label: "Gas Price (Gwei)" },
  { value: "cpu_usage", label: "CPU Usage (%)" },
  { value: "memory_usage", label: "Memory Usage (%)" },
  { value: "disk_usage", label: "Disk Usage (%)" },
];

const COLORS = [
  "#2563eb",
  "#9333ea",
  "#f97316",
  "#059669",
  "#dc2626",
  "#ec4899",
];

/** Side-by-side comparison of metrics across multiple nodes */
export function ComparisonPage() {
  const { data: nodes = [] } = useQuery({
    queryKey: ["nodes"],
    queryFn: fetchNodes,
    refetchInterval: 10_000,
  });

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [metric, setMetric] = useState("rpc_latency");

  /** Fetch metric history for each selected node */
  const seriesQueries = selectedNodeIds.map((nodeId) => {
    return useQuery({
      queryKey: ["comparison-metrics", nodeId, metric],
      queryFn: () => fetchMetrics({ nodeId, metricName: metric, limit: 120 }),
      enabled: selectedNodeIds.length > 0,
      refetchInterval: 10_000,
    });
  });

  /** Toggle a node in the selection */
  function toggleNode(id: string) {
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  }

  /** Merge all series data by timestamp into chart-friendly rows */
  function buildChartData(): Array<{ time: string; [key: string]: string | number }> {
    const timeMap = new Map<string, { time: string; [key: string]: string | number }>();

    seriesQueries.forEach((q, idx) => {
      const nodeId = selectedNodeIds[idx];
      const nodeName =
        nodes.find((n) => n.id === nodeId)?.name ?? nodeId.slice(0, 8);

      (q.data ?? [])
        .slice()
        .reverse()
        .forEach((row) => {
          const time = new Date(row.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const existing = timeMap.get(time) ?? { time };
          existing[nodeName] = Math.round(row.value * 100) / 100;
          timeMap.set(time, existing);
        });
    });

    return Array.from(timeMap.values());
  }

  const chartData = buildChartData();

  const chartSeries = selectedNodeIds.map((nodeId, idx) => {
    const name =
      nodes.find((n) => n.id === nodeId)?.name ?? nodeId.slice(0, 8);
    return { dataKey: name, color: COLORS[idx % COLORS.length], label: name };
  });

  return (
    <>
      <Header
        title="Compare Nodes"
        subtitle="Side-by-side Metric Comparison"
      />

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Node selector */}
        <div className="lg:col-span-3 bg-white border border-zinc-200 p-6">
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Select Nodes
          </h3>
          <div className="flex flex-wrap gap-2">
            {nodes.map((node) => {
              const active = selectedNodeIds.includes(node.id);
              return (
                <button
                  key={node.id}
                  onClick={() => toggleNode(node.id)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border transition-all ${
                    active
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  {node.name}
                </button>
              );
            })}
            {nodes.length === 0 && (
              <p className="text-xs font-mono text-zinc-400 uppercase">
                No nodes available
              </p>
            )}
          </div>
        </div>

        {/* Metric selector */}
        <div className="bg-white border border-zinc-200 p-6">
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Metric
          </h3>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {selectedNodeIds.length > 0 ? (
        <TimeSeriesChart
          title={`${METRIC_OPTIONS.find((o) => o.value === metric)?.label ?? metric}`}
          subtitle={`Comparing ${selectedNodeIds.length} nodes`}
          data={chartData}
          series={chartSeries}
        />
      ) : (
        <div className="bg-white border border-zinc-200 p-16 text-center">
          <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">
            Select two or more nodes above to compare metrics
          </p>
        </div>
      )}
    </>
  );
}
