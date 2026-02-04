import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Header } from "../components/layout/Header";
import { fetchAlerts, fetchAlertRules, acknowledgeAlert, resolveAlert } from "../api/client";

/** Full alerts page with alert history and rules list */
export function AlertsPage() {
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts-all"],
    queryFn: () => fetchAlerts({ limit: 100 }),
    refetchInterval: 5_000,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["alert-rules"],
    queryFn: fetchAlertRules,
  });

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-all"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-all"] }),
  });

  const unresolved = alerts.filter((a) => !a.resolved_at);
  const resolved = alerts.filter((a) => a.resolved_at);

  return (
    <>
      <Header title="System Events" subtitle={`${unresolved.length} Active Alerts`} />

      {/* Active alerts */}
      <div className="bg-white border border-zinc-200 mb-8">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-2 bg-zinc-900 text-white">
          <AlertTriangle size={18} className="text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest">
            Active Alerts
          </h3>
          <span className="ml-auto bg-white text-zinc-900 text-xs font-bold font-mono px-1.5 py-0.5">
            {unresolved.length.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="divide-y divide-zinc-200">
          {unresolved.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-mono text-xs uppercase tracking-widest">
                No Active Incidents
              </p>
            </div>
          ) : (
            unresolved.map((alert) => (
              <div
                key={alert.id}
                className="px-6 py-4 flex items-start gap-4 hover:bg-zinc-50 transition-colors border-l-4 border-l-transparent hover:border-l-zinc-300"
              >
                <div
                  className={`mt-1 ${
                    alert.severity === "critical"
                      ? "text-red-500"
                      : alert.severity === "warning"
                        ? "text-amber-500"
                        : "text-blue-500"
                  }`}
                >
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase leading-relaxed">
                    {alert.message}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                    <span
                      className={`px-1 font-bold uppercase ${
                        alert.severity === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    {alert.acknowledged === 1 && (
                      <span className="text-emerald-600 uppercase">Acknowledged</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => ackMutation.mutate(alert.id)}
                      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
                    >
                      <Check size={12} className="inline mr-1" />
                      Ack
                    </button>
                  )}
                  <button
                    onClick={() => resolveMutation.mutate(alert.id)}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-900 bg-white border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resolved alerts */}
      {resolved.length > 0 && (
        <div className="bg-white border border-zinc-200 mb-8">
          <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">
              Resolved ({resolved.length})
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
            {resolved.map((alert) => (
              <div
                key={alert.id}
                className="px-6 py-3 flex items-center gap-3 text-zinc-500"
              >
                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-mono truncate uppercase">
                  {alert.message}
                </span>
                <span className="ml-auto text-[10px] font-mono shrink-0">
                  {new Date(alert.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert rules */}
      <div className="bg-white border border-zinc-200">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-zinc-900" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">
              Alert Rules
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3 font-mono">Name</th>
                <th className="px-6 py-3 font-mono">Metric</th>
                <th className="px-6 py-3 font-mono">Condition</th>
                <th className="px-6 py-3 font-mono">Threshold</th>
                <th className="px-6 py-3 font-mono">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-6 py-3 text-sm font-bold text-zinc-900">
                    {rule.name}
                  </td>
                  <td className="px-6 py-3 text-xs font-mono text-zinc-600">
                    {rule.metric}
                  </td>
                  <td className="px-6 py-3 text-xs font-mono text-zinc-600">
                    {rule.condition}
                  </td>
                  <td className="px-6 py-3 text-xs font-mono text-zinc-600">
                    {rule.threshold}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-1 ${
                        rule.severity === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {rule.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
