import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { useFilterStore } from '../../stores/filters';

const PRESETS = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Compact date range picker — calendar icon that opens a dropdown panel. */
export function DateRangePicker() {
  const { from, to, setRange, clearRange } = useFilterStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /** Close when clicking outside */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasRange = from || to;
  const activePreset = PRESETS.find((p) => from === daysAgo(p.days) && to === today());

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`h-9 flex items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors border ${
          open || hasRange
            ? 'bg-primary text-white dark:bg-primary-dark dark:text-black border-primary dark:border-primary-dark'
            : 'bg-white dark:bg-card-dark text-secondary border-border dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800'
        } shadow-sm`}
      >
        <Calendar size={15} />
        {hasRange ? (
          <span className="text-xs">
            {from ? formatShort(from) : '...'} – {to ? formatShort(to) : '...'}
          </span>
        ) : (
          <span className="text-xs">Date Range</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white dark:bg-card-dark rounded-2xl shadow-xl border border-border dark:border-border-dark p-4 z-50 w-72">
          {/* Presets */}
          <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Quick Select</div>
          <div className="flex gap-1.5 mb-4">
            {PRESETS.map(({ label, days }) => (
              <button
                key={label}
                onClick={() => {
                  setRange(daysAgo(days), today());
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  activePreset?.days === days
                    ? 'bg-accent-green text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Custom Range</div>
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">From</label>
              <input
                type="date"
                value={from ?? ''}
                onChange={(e) => setRange(e.target.value || undefined, to)}
                className="w-full px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-border dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-accent-green/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">To</label>
              <input
                type="date"
                value={to ?? ''}
                onChange={(e) => setRange(from, e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-border dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-accent-green/30"
              />
            </div>
          </div>

          {/* Clear */}
          {hasRange && (
            <button
              onClick={() => { clearRange(); setOpen(false); }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <X size={13} />
              Clear range
            </button>
          )}
        </div>
      )}
    </div>
  );
}
