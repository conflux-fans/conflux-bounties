import { Server, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import type { Node } from "../../api/types";
import { useRealtimeStore } from "../../stores/realtimeStore";

interface NodeListProps {
  nodes: Node[];
}

/** Status badge derived from real-time sync_lag metric */
function StatusBadge({ nodeId }: { nodeId: string }) {
  const isSynced = useRealtimeStore((s) => s.getMetric(nodeId, "is_synced"));
  const syncLag = useRealtimeStore((s) => s.getMetric(nodeId, "sync_lag"));

  if (!isSynced && !syncLag) {
    return (
      <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border bg-zinc-100 text-zinc-500 border-zinc-200">
        Loading
      </span>
    );
  }

  const synced = isSynced?.value === 1;

  if (synced) {
    return (
      <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border bg-emerald-100 text-emerald-800 border-emerald-200">
        Healthy
      </span>
    );
  }

  return (
    <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border bg-blue-100 text-blue-800 border-blue-200">
      Syncing
    </span>
  );
}

/** Live metric value for a node */
function LiveMetric({ nodeId, metric }: { nodeId: string; metric: string }) {
  const data = useRealtimeStore((s) => s.getMetric(nodeId, metric));
  if (!data) return <span className="text-zinc-400">—</span>;
  return <>{Math.round(data.value).toLocaleString()}</>;
}

/** Node table matching the Conflux Pulse design */
export function NodeList({ nodes }: NodeListProps) {
  return (
    <div className="bg-white border border-zinc-200">
      <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-zinc-900" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">
            Active Nodes
          </h3>
        </div>
        <Link
          to="/nodes"
          className="text-xs font-mono text-zinc-500 hover:text-zinc-900 hover:underline uppercase"
        >
          :: View All Nodes
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-200">
            <tr>
              <th className="px-6 py-3 font-mono">ID / Endpoint</th>
              <th className="px-6 py-3 font-mono">Status</th>
              <th className="px-6 py-3 font-mono">Height</th>
              <th className="px-6 py-3 font-mono">Peers</th>
              <th className="px-6 py-3 font-mono">Latency</th>
              <th className="px-6 py-3 font-mono">Space</th>
              <th className="px-6 py-3 font-mono text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {nodes.map((node) => (
              <tr
                key={node.id}
                className="hover:bg-zinc-50 transition-colors group"
              >
                <td className="px-6 py-4">
                  <Link to={`/nodes/${node.id}`} className="flex items-center">
                    <div className="mr-3 text-zinc-300 group-hover:text-zinc-900 transition-colors">
                      <Server size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 font-sans">
                        {node.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[200px]">
                        {node.rpc_url}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge nodeId={node.id} />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-zinc-900 font-mono">
                    #<LiveMetric nodeId={node.id} metric="block_height" />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-zinc-600">
                  <span className="font-bold">
                    <LiveMetric nodeId={node.id} metric="peer_count" />
                  </span>
                </td>
                <td className="px-6 py-4">
                  <LatencyCell nodeId={node.id} />
                </td>
                <td className="px-6 py-4 text-xs font-mono text-zinc-400 uppercase">
                  {node.space_type}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/nodes/${node.id}`}
                    className="text-zinc-400 hover:text-zinc-900 transition-colors"
                  >
                    <MoreHorizontal size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Latency cell with conditional coloring and dot indicator */
function LatencyCell({ nodeId }: { nodeId: string }) {
  const data = useRealtimeStore((s) => s.getMetric(nodeId, "rpc_latency"));
  if (!data) return <span className="text-zinc-400">—</span>;

  const ms = Math.round(data.value);
  const isHigh = ms > 200;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-1.5 w-1.5 ${isHigh ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      <span
        className={`text-sm font-mono font-bold ${
          isHigh ? "text-amber-600" : "text-emerald-600"
        }`}
      >
        {ms}ms
      </span>
    </div>
  );
}
