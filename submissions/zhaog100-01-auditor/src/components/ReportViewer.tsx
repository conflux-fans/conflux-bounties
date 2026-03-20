'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReportViewerProps {
  jobId: string;
  contractAddress: string;
}

interface JobStatus {
  status: string;
  progress: number;
  errorMessage?: string;
}

interface AuditReport {
  contract: { address: string; name: string; compiler: string };
  analysis: { engine: string; timestamp: string };
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    overallRisk: string;
  };
  findings: any[];
  gasOptimizations: any[];
  codeQuality: any[];
}

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 border-red-800 bg-red-950',
  high: 'text-orange-400 border-orange-800 bg-orange-950',
  medium: 'text-yellow-400 border-yellow-800 bg-yellow-950',
  low: 'text-green-400 border-green-800 bg-green-950',
  info: 'text-blue-400 border-blue-800 bg-blue-950',
};

export function ReportViewer({ jobId, contractAddress }: ReportViewerProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'gas' | 'quality'>('findings');

  const pollStatus = useCallback(async () => {
    const res = await fetch(`/api/audit/status/${jobId}`);
    const data = await res.json();
    setStatus(data);

    if (data.status === 'completed') {
      const reportRes = await fetch(`/api/audit/report/${jobId}`);
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }
      return true;
    }
    if (data.status === 'failed') return true;
    return false;
  }, [jobId]);

  useEffect(() => {
    const poll = async () => {
      let done = await pollStatus();
      while (!done) {
        await new Promise(r => setTimeout(r, 3000));
        done = await pollStatus();
      }
    };
    poll();
  }, [pollStatus]);

  if (!status) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">Loading...</div>;
  }

  if (status.status === 'failed') {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/30 p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Analysis Failed</h3>
        <p className="text-red-300">{status.errorMessage || 'Unknown error'}</p>
      </div>
    );
  }

  if (status.status !== 'completed' || !report) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Analyzing Contract...</h3>
          <span className="text-sm text-slate-400">{status.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <p className="text-sm text-slate-500">Job ID: {jobId}</p>
      </div>
    );
  }

  const summary = report.summary;
  const items = activeTab === 'findings' ? report.findings
    : activeTab === 'gas' ? report.gasOptimizations
    : report.codeQuality;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={summary.totalFindings} color="text-white" />
        <StatCard label="Critical" value={summary.criticalCount} color="text-red-400" />
        <StatCard label="High" value={summary.highCount} color="text-orange-400" />
        <StatCard label="Medium" value={summary.mediumCount} color="text-yellow-400" />
        <StatCard label="Low" value={summary.lowCount} color="text-green-400" />
      </div>

      {/* Overall Risk */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Overall Risk:</span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium text-white ${RISK_COLORS[summary.overallRisk] || 'bg-slate-600'}`}>
          {summary.overallRisk.toUpperCase()}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
        {(['findings', 'gas', 'quality'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'findings' ? `Security (${report.findings.length})` : tab === 'gas' ? `Gas (${report.gasOptimizations.length})` : `Quality (${report.codeQuality.length})`}
          </button>
        ))}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No issues found in this category ✅</p>
        ) : (
          items.map((finding: any, i: number) => (
            <FindingCard key={i} finding={finding} />
          ))
        )}
      </div>

      {/* Contract Info */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm">
        <p className="text-slate-400">Contract: <span className="text-white font-mono">{report.contract.name}</span></p>
        <p className="text-slate-400">Compiler: <span className="text-white">{report.contract.compiler}</span></p>
        <p className="text-slate-400">Engine: <span className="text-white">{report.analysis.engine}</span></p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function FindingCard({ finding }: { finding: any }) {
  return (
    <div className={`rounded-lg border p-4 ${SEVERITY_COLORS[finding.severity] || 'border-slate-700 bg-slate-900'}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-white">{finding.title}</h4>
        <div className="flex items-center gap-2">
          {finding.swc && <span className="text-xs font-mono opacity-70">{finding.swc}</span>}
          {finding.cwe && <span className="text-xs font-mono opacity-70">{finding.cwe}</span>}
        </div>
      </div>
      <p className="text-sm opacity-80 mb-2">{finding.description}</p>
      {finding.codeSnippet && (
        <pre className="rounded bg-black/30 p-2 text-xs font-mono overflow-x-auto mb-2">
          <code>{finding.codeSnippet}</code>
        </pre>
      )}
      {finding.recommendation && (
        <p className="text-sm">
          <span className="font-medium">💡 Recommendation: </span>
          <span className="opacity-70">{finding.recommendation}</span>
        </p>
      )}
    </div>
  );
}
