import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/Header";
import { fetchHealth } from "../api/client";

/** Settings / system info page */
export function SettingsPage() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 5_000,
  });

  return (
    <>
      <Header title="Resources" subtitle="System Configuration & Status" />

      {/* System info */}
      {health && (
        <div className="bg-white border border-zinc-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-zinc-900" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">
              System Status
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoTile label="Status" value={health.status} />
            <InfoTile
              label="Uptime"
              value={formatUptime(health.uptime)}
            />
            <InfoTile
              label="Active Nodes"
              value={String(health.activeNodes)}
            />
            <InfoTile
              label="WS Connections"
              value={String(health.connections)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-zinc-900 font-mono">
        {value}
      </p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}D ${h.toString().padStart(2, "0")}H ${m.toString().padStart(2, "0")}M`;
}
