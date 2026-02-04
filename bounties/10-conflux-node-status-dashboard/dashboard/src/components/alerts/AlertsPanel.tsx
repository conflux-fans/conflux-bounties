import { Check, Clock, AlertTriangle, XSquare } from "lucide-react";
import type { Alert } from "../../api/types";

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
}

/** Compact alerts panel for the dashboard — matches the design reference */
export function AlertsPanel({ alerts, onAcknowledge }: AlertsPanelProps) {
  const active = alerts.filter((a) => !a.acknowledged && !a.resolved_at);

  return (
    <div className="bg-white border border-zinc-200 h-full flex flex-col">
      {/* Dark header */}
      <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-900 text-white">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest">
            System Events
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-zinc-400 font-mono">
            Count
          </span>
          <span className="bg-white text-zinc-900 text-xs font-bold font-mono px-1.5 py-0.5">
            {active.length.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <Check size={32} className="mb-2 opacity-50" />
            <p className="font-mono text-xs uppercase tracking-widest">
              No Active Incidents
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 border-b border-zinc-200">
            {active.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className="group p-4 bg-white hover:bg-zinc-50 transition-colors relative pl-4 border-l-4 border-l-transparent hover:border-l-zinc-300"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase px-1 ${
                          alert.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        <Clock size={10} className="inline mr-1" />
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-zinc-800 uppercase leading-relaxed">
                      {alert.message}
                    </h4>
                    <div className="mt-1 font-mono text-[10px] text-zinc-500">
                      SOURCE: {alert.node_id}
                    </div>
                  </div>
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="p-1 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                    title="Acknowledge"
                  >
                    <XSquare size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-white border-t border-zinc-200">
        <button className="w-full text-center text-[10px] uppercase font-bold tracking-widest text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 py-2 border border-dashed border-zinc-300 transition-all">
          :: View Event Log History
        </button>
      </div>
    </div>
  );
}
