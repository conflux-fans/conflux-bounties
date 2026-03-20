'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AuditPanel } from '@/components/AuditPanel';
import { ReportViewer } from '@/components/ReportViewer';
import { HistoryPanel } from '@/components/HistoryPanel';

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [showReport, setShowReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyAddress, setHistoryAddress] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const handleAuditStarted = useCallback((jobId: string, address: string) => {
    setCurrentJobId(jobId);
    setCurrentAddress(address);
    setShowReport(true);
    setShowHistory(false);
  }, []);

  const handleShowHistory = useCallback((address: string) => {
    setHistoryAddress(address);
    setShowHistory(true);
    setShowReport(false);
    setCurrentJobId(null);
  }, []);

  useEffect(() => {
    if (showReport && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showReport]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          AI Smart Contract Auditor
        </h2>
        <p className="text-slate-400 mb-4">
          Audit verified smart contracts on Conflux eSpace. Enter a contract address to detect vulnerabilities, gas issues, and code quality problems powered by AI.
        </p>
        <AuditPanel onAuditStarted={handleAuditStarted} />
      </section>

      {/* History Lookup */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Quick Lookup</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x... Enter address to view audit history"
            value={historyAddress}
            onChange={e => setHistoryAddress(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => handleShowHistory(historyAddress)}
            disabled={!historyAddress.startsWith('0x')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            View History
          </button>
        </div>
      </section>

      {/* Report Viewer */}
      {showReport && currentJobId && (
        <div ref={reportRef}>
          <ReportViewer jobId={currentJobId} contractAddress={currentAddress} />
        </div>
      )}

      {/* History Panel */}
      {showHistory && historyAddress && (
        <HistoryPanel address={historyAddress} />
      )}
    </div>
  );
}
