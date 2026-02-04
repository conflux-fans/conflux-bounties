import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { fetchNode, fetchMetrics, fetchLatestMetrics, buildCsvExportUrl } from "../api/client";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { StatCard } from "../components/cards/StatCard";
import {
  Database,
  Globe,
  RefreshCcw,
  Zap,
  Cpu,
  HardDrive,
} from "lucide-react";

/** Detail page for a single node with charts and all metrics */
export function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: node } = useQuery({
    queryKey: ["node", id],
    queryFn: () => fetchNode(id!),
    enabled: !!id,
  });

  const { data: latest = [] } = useQuery({
    queryKey: ["latest-metrics", id],
    queryFn: () => fetchLatestMetrics(id!),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const { data: latencyHistory = [] } = useQuery({
    queryKey: ["metrics-latency", id],
    queryFn: () =>
      fetchMetrics({ nodeId: id!, metricName: "rpc_latency", limit: 120 }),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const { data: blockHistory = [] } = useQuery({
    queryKey: ["metrics-block", id],
    queryFn: () =>
      fetchMetrics({ nodeId: id!, metricName: "block_height", limit: 120 }),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const { data: cpuHistory = [] } = useQuery({
    queryKey: ["metrics-cpu", id],
    queryFn: () =>
      fetchMetrics({ nodeId: id!, metricName: "cpu_usage", limit: 120 }),
    enabled: !!id,
    refetchInterval: 10_000,
  });

  /** Helper to get a latest metric value */
  function getVal(name: string): number | undefined {
    return latest.find((m) => m.metric_name === name)?.value;
  }

  /** Transform metric rows into chart-friendly format */
  function toChartData(rows: typeof latencyHistory, key: string) {
    return rows
      .slice()
      .reverse()
      .map((r) => ({
        time: new Date(r.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        [key]: Math.round(r.value * 100) / 100,
      }));
  }

  if (!node) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center text-zinc-400 font-mono">
        <div className="w-12 h-12 border-4 border-zinc-900 border-t-transparent animate-spin mb-4" />
        <div className="uppercase tracking-widest text-sm font-bold">Loading Node...</div>
      </div>
    );
  }

  return (
    <>
      {/* Back nav */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wide"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 uppercase tracking-tighter">
            {node.name}
          </h1>
          <p className="text-zinc-500 text-xs font-mono mt-1 uppercase tracking-wide">
            {node.rpc_url} :: {node.space_type} Space
          </p>
        </div>
        <button
          onClick={() =>
            window.open(buildCsvExportUrl({ nodeId: node.id }), "_blank")
          }
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-900 border border-zinc-900 hover:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wide"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Block Height"
          value={
            getVal("block_height")
              ? `#${getVal("block_height")!.toLocaleString()}`
              : "—"
          }
          icon={Database}
          color="blue"
        />
        <StatCard
          title="Peer Count"
          value={getVal("peer_count") ?? "—"}
          icon={Globe}
          color="purple"
        />
        <StatCard
          title="RPC Latency"
          value={
            getVal("rpc_latency")
              ? `${Math.round(getVal("rpc_latency")!)}ms`
              : "—"
          }
          icon={RefreshCcw}
          color={
            (getVal("rpc_latency") ?? 0) > 2000
              ? "red"
              : (getVal("rpc_latency") ?? 0) > 500
                ? "orange"
                : "green"
          }
        />
        <StatCard
          title="Gas Price"
          value={getVal("gas_price_gwei")?.toFixed(2) ?? "—"}
          subValue="GWEI"
          icon={Zap}
          color="orange"
        />
      </div>

      {/* System stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="CPU Usage"
          value={
            getVal("cpu_usage") !== undefined
              ? `${getVal("cpu_usage")!.toFixed(1)}%`
              : "—"
          }
          icon={Cpu}
          color={
            (getVal("cpu_usage") ?? 0) > 80
              ? "red"
              : (getVal("cpu_usage") ?? 0) > 50
                ? "orange"
                : "green"
          }
        />
        <StatCard
          title="Memory Usage"
          value={
            getVal("memory_usage") !== undefined
              ? `${getVal("memory_usage")!.toFixed(1)}%`
              : "—"
          }
          subValue={
            getVal("memory_used_gb") !== undefined
              ? `${getVal("memory_used_gb")!.toFixed(1)} GB`
              : undefined
          }
          icon={Database}
          color={
            (getVal("memory_usage") ?? 0) > 80
              ? "red"
              : (getVal("memory_usage") ?? 0) > 60
                ? "orange"
                : "green"
          }
        />
        <StatCard
          title="Disk Usage"
          value={
            getVal("disk_usage") !== undefined
              ? `${getVal("disk_usage")!.toFixed(1)}%`
              : "—"
          }
          icon={HardDrive}
          color={
            (getVal("disk_usage") ?? 0) > 80
              ? "red"
              : (getVal("disk_usage") ?? 0) > 60
                ? "orange"
                : "green"
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TimeSeriesChart
          title="RPC Latency"
          subtitle="Milliseconds over time"
          data={toChartData(latencyHistory, "latency")}
          series={[{ dataKey: "latency", color: "#2563eb", label: "Latency" }]}
        />
        <TimeSeriesChart
          title="Block Height"
          subtitle="Block progression"
          data={toChartData(blockHistory, "height")}
          series={[{ dataKey: "height", color: "#9333ea", label: "Height" }]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title="CPU Usage"
          subtitle="Percentage over time"
          data={toChartData(cpuHistory, "cpu")}
          series={[{ dataKey: "cpu", color: "#f97316", label: "CPU %" }]}
        />
      </div>
    </>
  );
}
