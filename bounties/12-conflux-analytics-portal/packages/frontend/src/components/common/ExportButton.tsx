import { Download } from 'lucide-react';
import { useFilterStore } from '../../stores/filters';

interface ExportButtonProps {
  widget: string;
}

/** Download CSV/JSON export for a given widget. */
export function ExportButton({ widget }: ExportButtonProps) {
  const { from, to } = useFilterStore();

  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const baseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
    window.open(`${baseUrl}/export/${widget}?${params.toString()}`, '_blank');
  };

  return (
    <div className="relative group">
      <button
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        title="Export"
      >
        <Download size={18} />
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-card-dark rounded-lg shadow-lg py-1 hidden group-hover:block z-10 min-w-[100px] border border-border dark:border-border-dark">
        <button
          onClick={() => handleExport('csv')}
          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          JSON
        </button>
      </div>
    </div>
  );
}
