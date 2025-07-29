'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  FileText,
  Code,
  AlertCircle,
  CheckCircle,
  Search,
  ExternalLink,
  BarChart3,
  Clock,
  Target
} from 'lucide-react';
import { FunctionBasedCodeViewer } from '@/components/ui/FunctionBasedCodeViewer';
import './audit-report.css';

interface AuditReportDetail {
  id: string;
  contractAddress: string;
  auditStatus: 'completed' | 'failed' | 'processing';
  findingsCount: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  createdAt: string;
  updatedAt: string;
  processingTimeMs?: number;
  errorMessage?: string;
  auditEngineVersion?: string;
  staticAnalysisTools?: string[];
  reportData?: {
    json: any;
    markdown: string;
  };
  sourceCode?: string;
}

type ViewMode = 'overview' | 'findings' | 'functions' | 'report';

export default function SimplifiedAuditReportPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [report, setReport] = useState<AuditReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  // Simple toast function
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    if (!jobId) return;
    
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(
          `/api/reports/detail/${jobId}?includeContent=true&includeSourceCode=true`
        );
        
        if (!res.ok) {
          if (res.status === 404) {
            setError('Audit report not found');
            return;
          }
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch audit report');
        }
        
        const data: AuditReportDetail = await res.json();
        setReport(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [jobId]);

  const downloadReport = () => {
    if (!report?.reportData?.markdown) return;
    
    const md = report.reportData.markdown;
    const date = new Date(report.createdAt).toISOString().split('T')[0];
    const filename = `audit-report-${report.contractAddress.slice(-8)}-${date}.md`;
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Downloaded ${filename}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon status-icon--completed" />;
      case 'failed':
        return <AlertCircle className="status-icon status-icon--error" />;
      case 'processing':
        return <div className="status-icon status-icon--processing" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string, count?: number) => {
    const className = `severity-badge severity-${severity}`;
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    return (
      <span className={className}>
        {label}{count !== undefined ? ` (${count})` : ''}
      </span>
    );
  };

  const renderOverview = () => {
    if (!report?.reportData?.json) return null;

    const findings = report.reportData.json.findings || [];
    const criticalFindings = findings.filter((f: any) => f.severity === 'critical');
    const highFindings = findings.filter((f: any) => f.severity === 'high');

    return (
      <div className="overview-content">
        <div className="overview-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Target className="icon" />
                Security Summary
              </h3>
            </div>
            <div className="card-content">
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-value">{report.findingsCount}</span>
                  <span className="stat-label">Total Issues</span>
                </div>
                <div className="stat-item critical">
                  <span className="stat-value">{report.severityBreakdown.critical}</span>
                  <span className="stat-label">Critical</span>
                </div>
                <div className="stat-item high">
                  <span className="stat-value">{report.severityBreakdown.high}</span>
                  <span className="stat-label">High</span>
                </div>
                <div className="stat-item medium">
                  <span className="stat-value">{report.severityBreakdown.medium}</span>
                  <span className="stat-label">Medium</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Clock className="icon" />
                Audit Details
              </h3>
            </div>
            <div className="card-content">
              <div className="audit-details">
                <div className="detail-item">
                  <span className="detail-label">Processing Time</span>
                  <span className="detail-value">
                    {report.processingTimeMs ? 
                      `${(report.processingTimeMs / 1000).toFixed(1)}s` : 
                      'N/A'
                    }
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Engine Version</span>
                  <span className="detail-value">
                    {report.auditEngineVersion || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tools Used</span>
                  <div className="tools-list">
                    {report.staticAnalysisTools?.map(tool => (
                      <span key={tool} className="badge badge-outline badge-sm">
                        {tool}
                      </span>
                    )) || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(criticalFindings.length > 0 || highFindings.length > 0) && (
          <div className="card priority-findings">
            <div className="card-header">
              <h3 className="card-title">
                <AlertCircle className="icon" style={{ color: 'var(--severity-critical)' }} />
                Priority Issues
              </h3>
            </div>
            <div className="card-content">
              <div className="priority-list">
                {criticalFindings.slice(0, 3).map((finding: any, idx: number) => (
                  <div key={idx} className="priority-item critical">
                    <div className="priority-severity">
                      {getSeverityBadge('critical')}
                    </div>
                    <div className="priority-content">
                      <h4>{finding.title}</h4>
                      <p>{finding.description}</p>
                    </div>
                  </div>
                ))}
                {highFindings.slice(0, 2).map((finding: any, idx: number) => (
                  <div key={idx} className="priority-item high">
                    <div className="priority-severity">
                      {getSeverityBadge('high')}
                    </div>
                    <div className="priority-content">
                      <h4>{finding.title}</h4>
                      <p>{finding.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              {(criticalFindings.length > 3 || highFindings.length > 2) && (
                <div className="view-all-prompt">
                  <button 
                    className="btn btn-outline"
                    onClick={() => setViewMode('findings')}
                  >
                    View All {criticalFindings.length + highFindings.length} Priority Issues
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFindings = () => {
    const all = report?.reportData?.json?.findings || [];
    let list = [...all];
    
    if (searchQuery) {
      list = list.filter((f: any) =>
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (severityFilter.length) {
      list = list.filter((f: any) => severityFilter.includes(f.severity));
    }
    
    const grouped: Record<string, any[]> = {};
    list.forEach(f => {
      grouped[f.severity] = grouped[f.severity] || [];
      grouped[f.severity].push(f);
    });
    
    const order = ['critical', 'high', 'medium', 'low', 'unknown'];

    return (
      <div className="findings-section">
        <div className="card findings-filters">
          <div className="filters-row">
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search findings..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="severity-buttons">
              {['critical', 'high', 'medium', 'low'].map(s => (
                <button
                  key={s}
                  className={`btn ${
                    severityFilter.includes(s) ? 'btn-primary' : 'btn-outline'
                  }`}
                  onClick={() =>
                    setSeverityFilter(prev =>
                      prev.includes(s)
                        ? prev.filter(x => x !== s)
                        : [...prev, s]
                    )
                  }
                >
                  {getSeverityBadge(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="findings-count">
          Showing {list.length} of {all.length} findings
        </div>

        {order.map(sev => {
          const items = grouped[sev] || [];
          if (!items.length) return null;
          
          return (
            <div key={sev} className="findings-group">
              <div className="findings-group__header">
                {getSeverityBadge(sev, items.length)}
                <h3 className="findings-group__title">
                  {`${sev} Severity`}
                </h3>
              </div>
              <div className="findings-group__list">
                {items.map((f, idx) => (
                  <div key={idx} className="finding-item">
                    <div className="card">
                      <div className="card-content">
                        <div className="finding-content">
                          <div className="finding-text">
                            <h4 className="finding-title">{f.title}</h4>
                            <p className="finding-desc">{f.description}</p>
                          </div>
                          <div className="finding-tags">
                            {f.swc_id && (
                              <span className="badge badge-outline badge-sm">
                                {f.swc_id}
                              </span>
                            )}
                            {f.cwe_id && (
                              <span className="badge badge-outline badge-sm">
                                {f.cwe_id}
                              </span>
                            )}
                          </div>
                          {f.lines?.length && (
                            <div className="finding-lines">
                              Affected lines: {f.lines.join(', ')}
                            </div>
                          )}
                          {f.recommendation && (
                            <div className="finding-recommendation">
                              <h5>💡 Recommendation:</h5>
                              <p>{f.recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!list.length && (
          <div className="findings-empty">
            <Search className="empty-icon" />
            <p>No findings match your criteria</p>
            <button
              className="btn btn-outline"
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter([]);
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderMarkdownReport = () => {
    if (!report?.reportData?.markdown) {
      return (
        <div className="empty">
          <FileText className="empty-icon" />
          <p>Full report not available</p>
        </div>
      );
    }

    // Simple markdown rendering - you could replace this with a proper markdown library
    const markdown = report.reportData.markdown;
    return (
      <div className="markdown-container">
        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
          {markdown}
        </pre>
      </div>
    );
  };

  const renderCodeAnalysis = () => {
    if (!report?.sourceCode || !report?.reportData?.json?.findings) {
      return (
        <div className="empty">
          <Code className="empty-icon" />
          <p>Code analysis not available</p>
        </div>
      );
    }

    // Extract findings from the report data
    const findings = report.reportData.json.findings || [];

    return (
      <div className="code-analysis">
        <FunctionBasedCodeViewer
          sourceCode={report.sourceCode}
          findings={findings}
          contractAddress={report.contractAddress}
          language="solidity"
          theme="light"
        />
      </div>
    );
  };


  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading audit report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <div className="card error-card">
          <div className="card-content">
            <div className="error-content">
              <AlertCircle className="error-icon" />
              <h2>Report Not Found</h2>
              <p>{error}</p>
              <div className="error-actions">
                <Link href="/history">
                  <button className="btn btn-primary">View All Reports</button>
                </Link>
                <Link href="/">
                  <button className="btn btn-secondary">Start New Audit</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="audit-page">
      {/* Toast */}
      {toastMessage && (
        <div className="toast">
          {toastMessage}
        </div>
      )}

      <header className="audit-header">
        <div className="header-inner">
          <div className="header-left">
            <Link href="/history">
              <button className="btn btn-secondary btn-lg">
                <ArrowLeft className="icon" /> Back to History
              </button>
            </Link>
            <div className="report-info">
              <div className="status-wrapper">
                {getStatusIcon(report.auditStatus)}
              </div>
              <div className="titles">
                <h1>Smart Contract Audit Report</h1>
                <div className="meta">
                  <span>Contract: {report.contractAddress.slice(0, 6)}...{report.contractAddress.slice(-4)}</span>
                  <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                  {report.processingTimeMs && (
                    <span>{(report.processingTimeMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="header-right">
            {report.auditStatus === 'completed' && report.reportData && (
              <>
                <button className="btn btn-secondary" onClick={downloadReport}>
                  <Download className="icon" />
                  Download Report
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    window.open(
                      `https://evm.confluxscan.net/address/${report.contractAddress}`,
                      '_blank'
                    )
                  }
                >
                  <ExternalLink className="icon" />
                  View Contract
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="audit-main">
        {report.auditStatus === 'completed' && report.reportData && (
          <section className="tabs-section">
            <div className="tabs-card">
              <nav className="tabs">
                {[
                  { mode: 'overview', label: 'Security Overview', icon: <BarChart3 /> },
                  { mode: 'findings', label: 'Detailed Findings', icon: <AlertCircle />, count: report.findingsCount },
                  { mode: 'functions', label: 'Code Analysis', icon: <Code /> },
                  { mode: 'report', label: 'Full Report', icon: <FileText /> }
                ].map(tab => (
                  <button
                    key={tab.mode}
                    onClick={() => setViewMode(tab.mode as ViewMode)}
                    className={viewMode === tab.mode ? 'tab tab--active' : 'tab'}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.count != null && (
                      <span className="badge badge-outline badge-sm">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              <div className="card-content">
                {viewMode === 'overview' && renderOverview()}
                {viewMode === 'findings' && renderFindings()}
                {viewMode === 'functions' && renderCodeAnalysis()}
                {viewMode === 'report' && renderMarkdownReport()}
              </div>
            </div>
          </section>
        )}

        {report.auditStatus === 'failed' && report.errorMessage && (
          <div className="card">
            <div className="card-content">
              <div className="state-failed">
                <AlertCircle className="icon" />
                <h3>Audit Failed</h3>
                <p>{report.errorMessage}</p>
                <Link href="/">
                  <button className="btn btn-primary">Retry</button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {report.auditStatus === 'processing' && (
          <div className="card">
            <div className="card-content">
              <div className="state-processing">
                <div className="spinner" />
                <h3>Processing...</h3>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 24px;
          background: var(--accent-green);
          color: white;
          border-radius: var(--radius-md);
          font-weight: 600;
          z-index: 1000;
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
}