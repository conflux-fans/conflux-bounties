import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  icon?: ReactNode;
}

/** Large stat card matching the design's "big number" style. */
export function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">{label}</h3>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div className="flex items-end gap-2 min-w-0">
        <span className="text-3xl font-bold tracking-tight truncate">{value}</span>
        {change && (
          <span className="text-sm font-semibold text-accent-green mb-1 shrink-0">{change}</span>
        )}
      </div>
    </div>
  );
}
