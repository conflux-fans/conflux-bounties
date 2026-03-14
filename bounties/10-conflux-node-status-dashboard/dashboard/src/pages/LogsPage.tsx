import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, AlertTriangle, CheckCircle, Info, Filter } from "lucide-react";
import { useState } from "react";
import { Header } from "../components/layout/Header";
import { fetchAlerts, fetchNodes, acknowledgeAlert, resolveAlert } from "../api/client";
import { useRealtimeStore } from "../stores/realtimeStore";

type SeverityFilter = "all" | "critical" | "warning" | "info";
type StatusFilter = "all" | "active" | "acknowledged" | "resolved";

/** Event log page — full timeline of all system events and alerts */
export function LogsPage() {
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nodeFilter, setNodeFilter] = useState("");

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts-log"],
    queryFn: () => fetchAlerts({ limit: 200 }),
    refetchInterval: 5_000,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ["nodes"],
    queryFn: fetchNodes,
  });

  const recentWsEvents = useRealtimeStore((s) => s.recentAlertEvents);

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-log"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-log"] }),
  });

  /** Apply filters */
  const filtered = alerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (nodeFilter && a.node_id !== nodeFilter) return false;
    if (statusFilter === "active" && (a.resolved_at || a.acknowledged)) return false;
    if (statusFilter === "acknowledged" && !a.acknowledged) return false;
    if (statusFilter === "resolved" && !a.resolved_at) return false;
    return true;
  });

  function getNodeName(nodeId: string): string {
    return nodes.find((n) => n.id === nodeId)?.name ?? nodeId.slice(0, 8);
  }

  return (
    <>
      <Header
        title="Event Log"
        subtitle={`${alerts.length} Total Events :: ${alerts.filter((a) => !a.resolved_at).length} Active`}
      />

      {/* Real-time event ticker */}
      {recentWsEvents.length > 0 && (
        <div className="bg-zinc-900 text-white p-4 mb-6 border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Live Feed
            </span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {recentWsEvents.slice(0, 5).map((evt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
                <span className={
                  evt.severity === "critical" ? "text-red-400" : "text-amber-400"
                }>
                  [{evt.severity.toUpperCase()}]
                </span>
                <span className="text-zinc-300 truncate">{evt.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-zinc-200 p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Filter size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Filters
          </span>
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          value={nodeFilter}
          onChange={(e) => setNodeFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
        >
          <option value="">All Nodes</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        <span className="ml-auto text-[10px] font-mono text-zinc-400 uppercase">
          Showing {filtered.length} of {alerts.length}
        </span>
      </div>

      {/* Event log table */}
      <div className="bg-white border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-900 text-white text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3 font-mono">Timestamp</th>
                <th className="px-6 py-3 font-mono">Severity</th>
                <th className="px-6 py-3 font-mono">Node</th>
                <th className="px-6 py-3 font-mono">Event</th>
                <th className="px-6 py-3 font-mono">Metric</th>
                <th className="px-6 py-3 font-mono">Value</th>
                <th className="px-6 py-3 font-mono">Status</th>
                <th className="px-6 py-3 font-mono">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Info size={32} className="mx-auto mb-2 text-zinc-300" />
                    <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                      No events match current filters
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((alert) => (
                  <tr
                    key={alert.id}
                    className="hover:bg-zinc-50 transition-colors border-l-4 border-l-transparent hover:border-l-zinc-300"
                  >
                    <td className="px-6 py-3 text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                      <Clock size={10} className="inline mr-1" />
                      {new Date(alert.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 ${
                          alert.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : alert.severity === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        <AlertTriangle size={10} />
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-zinc-600 uppercase">
                      {getNodeName(alert.node_id)}
                    </td>
                    <td className="px-6 py-3 text-xs font-bold text-zinc-800 uppercase max-w-xs truncate">
                      {alert.message}
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-zinc-500">
                      {alert.metric}
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-zinc-600">
                      {alert.value} / {alert.threshold}
                    </td>
                    <td className="px-6 py-3">
                      {alert.resolved_at ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600">
                          <CheckCircle size={10} />
                          Resolved
                        </span>
                      ) : alert.acknowledged ? (
                        <span className="text-[10px] font-bold uppercase text-blue-600">
                          Acked
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-red-600 animate-pulse">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1">
                        {!alert.acknowledged && !alert.resolved_at && (
                          <button
                            onClick={() => ackMutation.mutate(alert.id)}
                            className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-600 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 transition-colors"
                          >
                            Ack
                          </button>
                        )}
                        {!alert.resolved_at && (
                          <button
                            onClick={() => resolveMutation.mutate(alert.id)}
                            className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-900 bg-white border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
