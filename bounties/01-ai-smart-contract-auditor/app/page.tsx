'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface ProgressBarProps {
  progress: number;
}

function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div 
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      ></div>
    </div>
  );
}

interface AuditStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  reportUrl?: string;
}

interface ReportData {
  json: any;
  markdown: string;
}

export default function Home() {
  const [address, setAddress] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/audit/status/${jobId}`);
        const data = await response.json();

        if (response.ok) {
          setAuditStatus(data);
        } else {
          console.error('Status fetch error:', data.error);
          setAuditStatus(prevStatus => ({
            ...prevStatus,
            status: 'failed',
            progress: prevStatus?.progress || 0,
            errorMessage: data.error || 'Failed to fetch audit status'
          }));
        }
      } catch (err) {
        console.error('Error fetching status:', err);
        setAuditStatus(prevStatus => ({
          ...prevStatus,
          status: 'failed',
          progress: prevStatus?.progress || 0,
          errorMessage: 'Network error while checking audit status'
        }));
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    if (auditStatus?.status === 'completed' && auditStatus.reportUrl && !reportData) {
      fetchReport(auditStatus.reportUrl);
    }
  }, [auditStatus?.status, auditStatus?.reportUrl, reportData]);

  const fetchReport = async (reportUrl: string) => {
    try {
      const response = await fetch(reportUrl);
      const data = await response.json();
      
      if (response.ok) {
        setReportData(data);
      } else {
        console.error('Report fetch error:', data.error);
        setAuditStatus(prevStatus => ({
          ...prevStatus,
          status: 'failed',
          errorMessage: data.error || 'Failed to fetch audit report'
        }));
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setAuditStatus(prevStatus => ({
        ...prevStatus,
        status: 'failed',
        errorMessage: 'Network error while fetching audit report'
      }));
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStartAudit = async () => {
    if (!address.trim()) {
      setError('Please enter a contract address');
      return;
    }

    setLoading(true);
    setError(null);
    setAuditStatus(null);
    setReportData(null);

    try {
      const response = await fetch('/api/audit/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: address.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start audit');
      }

      setJobId(data.jobId);
    } catch (err) {
      console.error('Audit start error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while starting the audit');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending...';
      case 'processing': return 'Analysis in progress...';
      case 'completed': return 'Audit completed';
      case 'failed': return 'Audit failed';
      default: return 'Unknown status';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Smart Contract Auditor
          </h1>
          <p className="text-lg text-gray-600">
            Automated security analysis for Conflux smart contracts
          </p>
        </div>

        <div className="bg-white py-8 px-8 shadow-xl rounded-2xl border border-gray-100">
          {!jobId ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Address
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="cfx:... or 0x..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono transition duration-200 text-gray-900 bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && address.trim()) {
                      handleStartAudit();
                    }
                  }}
                />
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 font-medium">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleStartAudit}
                disabled={loading || !address.trim()}
                className="w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition duration-200 hover:scale-105 disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Starting Audit...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Start Security Audit
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-4
                  {auditStatus?.status === 'completed' ? 'bg-green-100 text-green-800' :
                   auditStatus?.status === 'failed' ? 'bg-red-100 text-red-800' :
                   auditStatus?.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                   'bg-gray-100 text-gray-800'}">
                  {auditStatus?.status === 'completed' && (
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {auditStatus?.status === 'failed' && (
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {auditStatus?.status === 'processing' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  )}
                  {auditStatus ? getStatusText(auditStatus.status) : 'Initializing audit...'}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Security Analysis in Progress
                </h2>
                <div className="bg-gray-50 px-4 py-2 rounded-lg inline-block">
                  <p className="text-sm text-gray-600 font-mono">
                    Job ID: {jobId}
                  </p>
                </div>
              </div>

              {auditStatus && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{auditStatus.progress}%</span>
                    </div>
                    <ProgressBar progress={auditStatus.progress} />
                  </div>
                  
                  {auditStatus.status === 'processing' && (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}

                  {auditStatus.errorMessage && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-base font-semibold text-red-800">
                            Audit Failed
                          </h3>
                          <p className="mt-2 text-sm text-red-700">
                            {auditStatus.errorMessage}
                          </p>
                          <div className="mt-4">
                            <button
                              onClick={() => {
                                setJobId(null);
                                setAuditStatus(null);
                                setError(null);
                              }}
                              className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md font-medium transition duration-200"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {auditStatus.status === 'completed' && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-6 rounded-lg">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-base font-semibold text-green-800">
                            Audit Completed Successfully!
                          </h3>
                          <p className="mt-2 text-sm text-green-700">
                            Your smart contract has been thoroughly analyzed. Review the detailed report below.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reportData && (
                <div className="space-y-6 mt-6">
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Audit Report
                    </h3>
                    
                    <div className="flex flex-wrap gap-3 mb-6">
                      <button
                        onClick={() => setShowJson(!showJson)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {showJson ? 'Show Markdown' : 'Show JSON'}
                      </button>
                      <button
                        onClick={() => downloadFile(JSON.stringify(reportData.json, null, 2), `audit-report-${jobId}.json`, 'application/json')}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-sm transition duration-200"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download JSON
                      </button>
                      <button
                        onClick={() => downloadFile(reportData.markdown, `audit-report-${jobId}.md`, 'text/markdown')}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-sm transition duration-200"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Markdown
                      </button>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto shadow-inner">
                      {showJson ? (
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                          {JSON.stringify(reportData.json, null, 2)}
                        </pre>
                      ) : (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{reportData.markdown}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!auditStatus && (
                <div className="text-center py-8">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full opacity-20"></div>
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Initializing Security Audit
                  </h3>
                  <p className="text-sm text-gray-500">
                    Setting up analysis environment and fetching contract data...
                  </p>
                </div>
              )}

              <div className="border-t pt-6">
                <button
                  onClick={() => {
                    setJobId(null);
                    setAuditStatus(null);
                    setReportData(null);
                    setAddress('');
                    setShowJson(false);
                    setError(null);
                  }}
                  className="w-full flex justify-center items-center py-3 px-6 border-2 border-gray-300 rounded-lg shadow-sm text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Start New Audit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}