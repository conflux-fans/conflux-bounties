"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LayoutGrid, PlusSquare, ShieldAlert } from "lucide-react";
import { Button } from "./ui/Button";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const STATS_DATA = [
  { name: "Mon", sub: 4 },
  { name: "Tue", sub: 7 },
  { name: "Wed", sub: 3 },
  { name: "Thu", sub: 12 },
  { name: "Fri", sub: 8 },
  { name: "Sat", sub: 5 },
  { name: "Sun", sub: 10 },
];

const NAV_ITEMS = [
  { href: "/", label: "Registry", icon: LayoutGrid },
  { href: "/submit", label: "Submit Metadata", icon: PlusSquare },
  { href: "/admin", label: "Moderation", icon: ShieldAlert },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-64 bg-white border-r border-zinc-200 flex flex-col fixed md:relative h-screen z-10">
      <div className="h-16 flex items-center px-6 border-b border-zinc-200">
        <div className="w-4 h-4 bg-black mr-2" />
        <span className="font-[family-name:var(--font-space-grotesk)] font-bold text-lg tracking-tight">
          REGISTRY
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
                icon={<item.icon className="w-4 h-4" />}
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Mini Stats */}
      <div className="p-6 border-t border-zinc-200">
        <div className="mb-4">
          <span className="text-xs uppercase text-zinc-400 font-bold tracking-widest">
            Network Activity
          </span>
          <div className="h-20 mt-2 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={STATS_DATA}>
                <Bar dataKey="sub" fill="#1a1a1a" radius={[0, 0, 0, 0]} />
                <Tooltip
                  cursor={{ fill: "#f4f4f5" }}
                  contentStyle={{
                    background: "#000",
                    color: "#fff",
                    border: "none",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-200">
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
        />
      </div>
    </aside>
  );
}
