'use client';

import { useEffect, useState } from 'react';

interface LogEntry {
  id: string;
  address: string;
  path: string;
  granted: boolean;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function AccessLogTable() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/logs')
      .then((r) => r.json())
      .then((data) => { setLogs(data.logs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading logs…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs uppercase bg-gray-800 text-gray-400">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">Path</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Reason</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-700">
              <td className="px-4 py-2">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2 font-mono">{log.address.slice(0, 6)}…{log.address.slice(-4)}</td>
              <td className="px-4 py-2">{log.path}</td>
              <td className="px-4 py-2">
                <span className={log.granted ? 'text-green-400' : 'text-red-400'}>
                  {log.granted ? '✅ Granted' : '❌ Denied'}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-500">{log.reason ?? '—'}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No logs yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
