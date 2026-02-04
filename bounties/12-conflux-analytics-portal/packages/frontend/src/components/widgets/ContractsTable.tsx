import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTopContracts } from '../../api/hooks';

type SortField = 'tx_count' | 'gas_used' | 'unique_callers';

/** Sortable contracts leaderboard table. */
export function ContractsTable() {
  const [sort, setSort] = useState<SortField>('tx_count');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const { data, isLoading } = useTopContracts(sort, order);

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(field);
      setOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort !== field) return <ChevronDown size={14} className="text-gray-300" />;
    return order === 'desc'
      ? <ChevronDown size={14} className="text-black dark:text-white" />
      : <ChevronUp size={14} className="text-black dark:text-white" />;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>;
  }

  const rows = data?.data ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
            <th className="pb-3 font-semibold">#</th>
            <th className="pb-3 font-semibold">Contract</th>
            <th className="pb-3 font-semibold">DApp</th>
            <th className="pb-3 font-semibold cursor-pointer select-none" onClick={() => toggleSort('tx_count')}>
              <span className="flex items-center gap-1">Txns <SortIcon field="tx_count" /></span>
            </th>
            <th className="pb-3 font-semibold cursor-pointer select-none" onClick={() => toggleSort('unique_callers')}>
              <span className="flex items-center gap-1">Callers <SortIcon field="unique_callers" /></span>
            </th>
            <th className="pb-3 font-semibold cursor-pointer select-none" onClick={() => toggleSort('gas_used')}>
              <span className="flex items-center gap-1">Gas Used <SortIcon field="gas_used" /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.contract_address} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <td className="py-3 text-gray-400 font-medium">{i + 1}</td>
              <td className="py-3 font-mono text-xs">
                {r.contract_address.slice(0, 8)}...{r.contract_address.slice(-6)}
              </td>
              <td className="py-3">
                {r.dapp_name ? (
                  <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs font-medium">
                    {r.dapp_name}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 font-semibold">{r.tx_count.toLocaleString()}</td>
              <td className="py-3">{r.unique_callers.toLocaleString()}</td>
              <td className="py-3 text-gray-500">{Number(r.gas_used).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-10 text-gray-400">No contract data available</div>
      )}
    </div>
  );
}
