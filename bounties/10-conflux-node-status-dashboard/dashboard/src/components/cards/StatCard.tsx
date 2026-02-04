import type { LucideIcon } from "lucide-react";

/** Color styles for the left border accent and icon */
const COLOR_STYLES: Record<string, { border: string; text: string }> = {
  blue: { border: "border-l-blue-600", text: "text-blue-600" },
  green: { border: "border-l-emerald-600", text: "text-emerald-600" },
  red: { border: "border-l-red-600", text: "text-red-600" },
  orange: { border: "border-l-orange-600", text: "text-orange-600" },
  purple: { border: "border-l-purple-600", text: "text-purple-600" },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

/** Metric summary card matching the Conflux Pulse design */
export function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  color = "blue",
  trend,
  trendValue,
}: StatCardProps) {
  const styles = COLOR_STYLES[color] ?? COLOR_STYLES.blue;

  return (
    <div
      className={`bg-white p-6 border border-zinc-200 border-l-4 ${styles.border} relative group hover:bg-zinc-50/50 hover:border-zinc-300 transition-colors duration-200`}
    >
      {/* Technical corner marker */}
      <div className="absolute top-0 right-0 p-1">
        <div className="w-1.5 h-1.5 bg-zinc-100 group-hover:bg-zinc-300 transition-colors" />
      </div>

      <div className="flex justify-between items-start mb-4">
        <div className={`flex items-center gap-2 ${styles.text}`}>
          <Icon size={20} strokeWidth={1.5} />
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">
            Metric
          </span>
        </div>
        {trend && trendValue && (
          <div
            className={`flex items-center text-xs font-mono font-bold ${
              trend === "up"
                ? "text-emerald-600"
                : trend === "down"
                  ? "text-red-600"
                  : "text-zinc-400"
            }`}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"} {trendValue}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">
          {title}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-zinc-900 font-mono tracking-tighter">
            {value}
          </span>
          {subValue && (
            <span className="text-xs text-zinc-400 font-mono uppercase">
              {subValue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
