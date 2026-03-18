'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatDistanceToNow } from 'date-fns';

export default function ExecutionHistory() {
  const { address } = useAccount();
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchExecutions();
    }
  }, [address]);

  const fetchExecutions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/executions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setExecutions(data);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="card text-center py-8">Loading history...</div>;
  }

  if (executions.length === 0) {
    return (
      <div className="card text-center py-16">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-xl font-semibold mb-2">No Executions Yet</h3>
        <p className="text-gray-400">Your job execution history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Execution History</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4">Job ID</th>
              <th className="text-left py-3 px-4">Amount In</th>
              <th className="text-left py-3 px-4">Amount Out</th>
              <th className="text-left py-3 px-4">Price</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Time</th>
              <th className="text-left py-3 px-4">TX</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((exec) => (
              <tr key={exec.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-4 px-4">
                  <span className="font-mono text-sm">#{exec.job_id}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="font-mono text-sm">{exec.amount_in}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="font-mono text-sm">{exec.amount_out}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="font-mono text-sm">${exec.price}</span>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    exec.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {exec.success ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="py-4 px-4 text-sm text-gray-400">
                  {formatDistanceToNow(exec.executed_at, { addSuffix: true })}
                </td>
                <td className="py-4 px-4">
                  {exec.tx_hash ? (
                    <a
                      href={`https://testnet.confluxscan.net/tx/${exec.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-conflux-primary hover:underline text-sm font-mono"
                    >
                      {exec.tx_hash.slice(0, 10)}...
                    </a>
                  ) : (
                    <span className="text-gray-500 text-sm">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
