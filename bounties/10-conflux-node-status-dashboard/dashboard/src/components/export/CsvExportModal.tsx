import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Download } from "lucide-react";
import { fetchNodes, fetchMetricNames, buildCsvExportUrl } from "../../api/client";

interface CsvExportModalProps {
  onClose: () => void;
}

const RANGE_OPTIONS = [
  { label: "Last 1 hour", hours: 1 },
  { label: "Last 6 hours", hours: 6 },
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 7 days", hours: 168 },
  { label: "Last 30 days", hours: 720 },
  { label: "Custom", hours: 0 },
];

/** Modal for CSV export with selectable date range and metric */
export function CsvExportModal({ onClose }: CsvExportModalProps) {
  const { data: nodes = [] } = useQuery({
    queryKey: ["nodes"],
    queryFn: fetchNodes,
  });

  const [nodeId, setNodeId] = useState("");
  const [rangeHours, setRangeHours] = useState(24);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [metricName, setMetricName] = useState("");

  const selectedNodeId = nodeId || nodes[0]?.id || "";

  const { data: metricNames = [] } = useQuery({
    queryKey: ["metric-names", selectedNodeId],
    queryFn: () => fetchMetricNames(selectedNodeId),
    enabled: !!selectedNodeId,
  });

  function handleExport() {
    if (!selectedNodeId) return;

    let from: number | undefined;
    let to: number | undefined;

    if (rangeHours > 0) {
      from = Date.now() - rangeHours * 60 * 60 * 1000;
      to = Date.now();
    } else if (customFrom) {
      from = new Date(customFrom).getTime();
      to = customTo ? new Date(customTo).getTime() : Date.now();
    }

    const url = buildCsvExportUrl({
      nodeId: selectedNodeId,
      metricName: metricName || undefined,
      from,
      to,
    });
    window.open(url, "_blank");
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 bg-zinc-900 text-white">
          <h2 className="text-sm font-bold uppercase tracking-widest">
            Export CSV
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Node selector */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Node
            </label>
            <select
              value={selectedNodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          {/* Metric selector */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Metric
            </label>
            <select
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
            >
              <option value="">All metrics</option>
              {metricNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range selector */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Date Range
            </label>
            <select
              value={rangeHours}
              onChange={(e) => setRangeHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono uppercase focus:ring-2 focus:ring-zinc-900 outline-none"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.hours}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom date inputs */}
          {rangeHours === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  From
                </label>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  To
                </label>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs font-mono focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedNodeId}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-900 border border-zinc-900 hover:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
