import { useState } from 'react';
import { useTokens, useTokenHolders } from '../../api/hooks';
import { ChevronRight } from 'lucide-react';

/** Token list table. Clicking a row expands to show top holders. */
export function TokensTable() {
  const { data, isLoading } = useTokens();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: holdersData } = useTokenHolders(selected ?? '');

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
            <th className="pb-3 font-semibold">Token</th>
            <th className="pb-3 font-semibold">Symbol</th>
            <th className="pb-3 font-semibold">Transfers</th>
            <th className="pb-3 font-semibold">Holders</th>
            <th className="pb-3 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <>
              <tr
                key={r.address}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                onClick={() => setSelected(selected === r.address ? null : r.address)}
              >
                <td className="py-3 text-gray-400 font-medium">{i + 1}</td>
                <td className="py-3 font-semibold">{r.name || 'Unknown'}</td>
                <td className="py-3">
                  <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs font-medium">
                    {r.symbol}
                  </span>
                </td>
                <td className="py-3">{r.transfer_count.toLocaleString()}</td>
                <td className="py-3">{r.holder_count.toLocaleString()}</td>
                <td className="py-3">
                  <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform ${selected === r.address ? 'rotate-90' : ''}`}
                  />
                </td>
              </tr>
              {selected === r.address && holdersData && (
                <tr key={`${r.address}-holders`}>
                  <td colSpan={6} className="px-8 py-4 bg-gray-50 dark:bg-gray-900/30">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Top Holders</div>
                    <div className="grid grid-cols-2 gap-2">
                      {holdersData.data.map((h, j) => (
                        <div key={j} className="flex justify-between text-xs py-1">
                          <span className="font-mono text-gray-500">{h.holder_address.slice(0, 10)}...{h.holder_address.slice(-6)}</span>
                          <span className="font-semibold">{Number(h.balance).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {holdersData.data.length === 0 && (
                      <div className="text-gray-400 text-xs">No holder data</div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-10 text-gray-400">No token data available</div>
      )}
    </div>
  );
}
