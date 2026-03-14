import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/Header";
import { fetchAlerts } from "../api/client";

export function LogsPage() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetchAlerts({ limit: 100 }),
    refetchInterval: 10_000,
  });

  const sortedAlerts = [...alerts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <>
      <Header title="Logs" subtitle="Event Log History" />

      <div className="bg-white border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Node
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900"></div>
                    </div>
                  </td>
                </tr>
              ) : sortedAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-400 font-mono text-xs uppercase">
                    No logs available
                  </td>
                </tr>
              ) : (
                sortedAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-zinc-500">
                      {new Date(alert.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-zinc-900 uppercase">
                      {alert.rule_name || "Alert"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          alert.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : alert.severity === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500">
                      {alert.node_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-600 max-w-md truncate">
                      {alert.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          alert.acknowledged_at
                            ? "bg-emerald-100 text-emerald-700"
                            : alert.resolved_at
                            ? "bg-zinc-100 text-zinc-500"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {alert.acknowledged_at ? "Acknowledged" : alert.resolved_at ? "Resolved" : "Active"}
                      </span>
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
