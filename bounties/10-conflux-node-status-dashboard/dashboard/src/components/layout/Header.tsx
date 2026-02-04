import { Download } from "lucide-react";
import { useRealtimeStore } from "../../stores/realtimeStore";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onExportCsv?: () => void;
}

/** Top header bar with title and optional CSV export */
export function Header({ title, subtitle, onExportCsv }: HeaderProps) {
  const connected = useRealtimeStore((s) => s.connected);

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-zinc-200 pb-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 uppercase tracking-tighter">
          {title}
        </h1>
        {subtitle && (
          <p className="text-zinc-500 text-xs font-mono mt-1 uppercase tracking-wide">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Auto-refresh indicator */}
        <div className="hidden md:flex items-center px-3 py-2 bg-white border border-zinc-200 text-xs font-mono text-zinc-500">
          <span
            className={`w-2 h-2 mr-2 ${
              connected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          {connected ? "AUTO-REFRESH: 3s" : "DISCONNECTED"}
        </div>

        {/* CSV export */}
        {onExportCsv && (
          <button
            onClick={onExportCsv}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-900 border border-zinc-900 hover:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wide"
          >
            <Download size={14} />
            Export Data
          </button>
        )}
      </div>
    </header>
  );
}
