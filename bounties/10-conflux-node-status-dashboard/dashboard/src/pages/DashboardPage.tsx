import { useQuery } from "@tanstack/react-query";
import { Database, Globe, RefreshCcw, Zap } from "lucide-react";
import { Header } from "../components/layout/Header";
import { StatCard } from "../components/cards/StatCard";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { AlertsPanel } from "../components/alerts/AlertsPanel";
import { NodeList } from "../components/nodes/NodeList";
import {
  fetchNodes,
  fetchAlerts,
  fetchMetrics,
  acknowledgeAlert,
  buildCsvExportUrl,
} from "../api/client";
import { useRealtimeStore } from "../stores/realtimeStore";

/** Main dashboard overview page */
export function DashboardPage() {
  const { data: nodes = [] } = useQuery({
    queryKey: ["nodes"],
    queryFn: fetchNodes,
    refetchInterval: 10_000,
  });

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetchAlerts({ limit: 20 }),
    refetchInterval: 10_000,
  });

  /** Use first node for the main chart */
  const firstNodeId = nodes[0]?.id;
  const { data: chartData = [] } = useQuery({
    queryKey: ["metrics-chart", firstNodeId],
    queryFn: () =>
      fetchMetrics({
        nodeId: firstNodeId!,
        metricName: "rpc_latency",
        limit: 60,
      }),
    enabled: !!firstNodeId,
    refetchInterval: 5_000,
  });

  const getMetric = useRealtimeStore((s) => s.getMetric);

  /** Aggregate stats from real-time data */
  const latestBlock = nodes.reduce((max, n) => {
    const h = getMetric(n.id, "block_height");
    return h ? Math.max(max, h.value) : max;
  }, 0);

  const totalPeers = nodes.reduce((sum, n) => {
    const p = getMetric(n.id, "peer_count");
    return sum + (p?.value ?? 0);
  }, 0);

  const avgLatency =
    nodes.length > 0
      ? Math.round(
          nodes.reduce((sum, n) => {
            const l = getMetric(n.id, "rpc_latency");
            return sum + (l?.value ?? 0);
          }, 0) / nodes.length
        )
      : 0;

  const avgGasGwei =
    nodes.length > 0
      ? (
          nodes.reduce((sum, n) => {
            const g = getMetric(n.id, "gas_price_gwei");
            return sum + (g?.value ?? 0);
          }, 0) / nodes.length
        ).toFixed(2)
      : "0";

  /** Transform chart data for the TimeSeriesChart */
  const chartSeries = chartData
    .slice()
    .reverse()
    .map((row) => ({
      time: new Date(row.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      latency: row.value,
    }));

  async function handleAcknowledge(id: string) {
    await acknowledgeAlert(id);
    refetchAlerts();
  }

  function handleExportCsv() {
    if (!firstNodeId) return;
    const url = buildCsvExportUrl({ nodeId: firstNodeId });
    window.open(url, "_blank");
  }

  return (
    <>
      <Header
        title="Mission Control"
        subtitle={`System Overview :: ${nodes.length} Nodes Active :: Zone US-EAST`}
        onExportCsv={handleExportCsv}
      />

      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Latest Block"
          value={latestBlock > 0 ? `#${latestBlock.toLocaleString()}` : "—"}
          icon={Database}
          color="blue"
          trend="up"
          trendValue="+1.0/s"
        />
        <StatCard
          title="Active Peers"
          value={totalPeers}
          subValue="GLOBAL"
          icon={Globe}
          color="purple"
          trend="neutral"
          trendValue="STABLE"
        />
        <StatCard
          title="Avg Latency"
          value={avgLatency > 0 ? `${avgLatency}ms` : "—"}
          icon={RefreshCcw}
          color={avgLatency > 200 ? "red" : "green"}
          trend={avgLatency > 150 ? "down" : "up"}
          trendValue={avgLatency > 150 ? "LAG DETECTED" : "OPTIMAL"}
        />
        <StatCard
          title="Gas Price"
          value={avgGasGwei}
          subValue="GWEI"
          icon={Zap}
          color="orange"
          trend="up"
          trendValue="+2.4%"
        />
      </div>

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 lg:h-[450px]">
        <div className="lg:col-span-2 h-full min-h-[400px]">
          <TimeSeriesChart
            title="Network Performance"
            subtitle="Real-time RPC Latency & Throughput"
            data={chartSeries}
            series={[{ dataKey: "latency", color: "#2563eb", label: "Latency" }]}
          />
        </div>
        <div className="h-full min-h-[400px]">
          <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
        </div>
      </div>

      {/* Node table */}
      <div className="mb-12">
        <NodeList nodes={nodes} />
      </div>
    </>
  );
}
