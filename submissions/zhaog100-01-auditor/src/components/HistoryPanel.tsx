'use client';

import { useState, useEffect } from 'react';

interface HistoryPanelProps {
  address: string;
}

export function HistoryPanel({ address }: HistoryPanelProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/reports/${address}/history`);
        if (!res.ok) throw new Error('Not found');
        setData(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [address]);

  if (loading) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">Loading history...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <p className="text-slate-400">No audit history found for <span className="font-mono text-white">{address}</span></p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">
        Audit History: {data.name || data.address}
      </h3>
      {data.reports.length === 0 ? (
        <p className="text-slate-500">No audits performed yet.</p>
      ) : (
        <div className="space-y-3">
          {data.reports.map((report: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <div>
                <span className="text-sm text-white font-medium">#{report.id}</span>
                <span className="text-xs text-slate-400 ml-2">Engine: {report.engine}</span>
                <span className="text-xs text-slate-500 ml-2">Score: {report.severityScore}</span>
              </div>
              <div className="text-xs text-slate-400">
                {new Date(report.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
