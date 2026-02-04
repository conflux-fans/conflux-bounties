import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

/** Root layout with fixed sidebar and scrollable content area */
export function MainLayout() {
  return (
    <div className="min-h-screen flex font-sans text-zinc-900 bg-zinc-100">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 lg:p-8 overflow-y-auto">
        <Outlet />
        <footer className="border-t border-zinc-200 pt-6 mt-12 flex justify-between items-center text-[10px] font-mono text-zinc-400 uppercase">
          <div>Conflux Pulse Dashboard</div>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-zinc-900">Documentation</span>
            <span className="cursor-pointer hover:text-zinc-900">API Status</span>
            <span className="cursor-pointer hover:text-zinc-900">Support</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
