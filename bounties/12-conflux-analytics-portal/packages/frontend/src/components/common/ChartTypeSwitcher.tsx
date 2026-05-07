import { BarChart3, LineChart, AreaChart } from 'lucide-react';

export type ChartType = 'bar' | 'line' | 'area';

interface ChartTypeSwitcherProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

const OPTIONS: { type: ChartType; icon: typeof BarChart3; label: string }[] = [
  { type: 'bar', icon: BarChart3, label: 'Bar' },
  { type: 'line', icon: LineChart, label: 'Line' },
  { type: 'area', icon: AreaChart, label: 'Area' },
];

/** Pill-style chart type switcher with icon buttons. */
export function ChartTypeSwitcher({ value, onChange }: ChartTypeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {OPTIONS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`p-1.5 rounded-md transition-colors ${
            value === type
              ? 'bg-white dark:bg-card-dark shadow-sm text-primary dark:text-primary-dark'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
          title={label}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
