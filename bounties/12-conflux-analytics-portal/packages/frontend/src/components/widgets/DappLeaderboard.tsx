import { useDappLeaderboard } from '../../api/hooks';

interface DappLeaderboardProps {
  category?: string;
}

/** DApp leaderboard table. */
export function DappLeaderboard({ category }: DappLeaderboardProps) {
  const { data, isLoading } = useDappLeaderboard(category);

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
            <th className="pb-3 font-semibold">DApp</th>
            <th className="pb-3 font-semibold">Category</th>
            <th className="pb-3 font-semibold">Transactions</th>
            <th className="pb-3 font-semibold">Users</th>
            <th className="pb-3 font-semibold">Gas Used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.dapp_name} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <td className="py-3 text-gray-400 font-medium">{i + 1}</td>
              <td className="py-3 font-semibold">{r.dapp_name}</td>
              <td className="py-3">
                <span className="bg-accent-green-light dark:bg-accent-green/20 text-accent-green px-2 py-0.5 rounded-full text-xs font-semibold">
                  {r.category}
                </span>
              </td>
              <td className="py-3 font-semibold">{r.tx_count.toLocaleString()}</td>
              <td className="py-3">{r.unique_callers.toLocaleString()}</td>
              <td className="py-3 text-gray-500">{Number(r.gas_used).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-10 text-gray-400">No DApp data available</div>
      )}
    </div>
  );
}
