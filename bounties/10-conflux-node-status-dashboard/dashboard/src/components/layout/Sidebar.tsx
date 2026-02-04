import { NavLink } from "react-router-dom";
import {
  Zap,
  LayoutGrid,
  AlertTriangle,
  GitCompareArrows,
  Settings,
  Server,
} from "lucide-react";
import { useRealtimeStore } from "../../stores/realtimeStore";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/nodes", label: "Nodes", icon: Server },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/comparison", label: "Compare", icon: GitCompareArrows },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Fixed left sidebar with navigation and live status indicator */
export function Sidebar() {
  const connected = useRealtimeStore((s) => s.connected);

  return (
    <aside className="w-72 bg-white border-r border-zinc-200 hidden lg:flex flex-col fixed h-full z-10">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-200">
        <div className="flex items-center gap-3 text-zinc-900 font-bold text-xl tracking-tighter uppercase">
          <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center text-white">
            <Zap size={18} fill="currentColor" />
          </div>
          Conflux Pulse
        </div>
        <div className="mt-2 text-[10px] font-mono text-zinc-400 uppercase tracking-widest pl-11">
          v1.4.2 [BETA]
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-1">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 pl-2">
          Main Menu
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-3 font-medium text-sm cursor-pointer border transition-all ${
                isActive
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent hover:border-zinc-200"
              }`
            }
          >
            <item.icon size={18} />
            <span className="uppercase tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* System Status Footer */}
      <div className="p-6 border-t border-zinc-200 bg-zinc-50">
        <div className="border border-zinc-200 bg-white p-4">
          <div className="flex justify-between items-end mb-2">
            <h4 className="font-bold uppercase text-xs tracking-widest text-zinc-900">
              System Status
            </h4>
            <div
              className={`w-2 h-2 ${
                connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
          </div>
          <div className="font-mono text-[10px] text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>STATUS</span>
              <span className={connected ? "text-emerald-600" : "text-red-600"}>
                {connected ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>COLLECTOR</span>
              <span className={connected ? "text-emerald-600" : "text-zinc-400"}>
                {connected ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
