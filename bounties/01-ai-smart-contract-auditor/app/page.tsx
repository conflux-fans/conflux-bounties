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
        }
      } catch (err) {
        console.error('Erreur lors de la récupération du statut:', err);
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
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du rapport:', err);
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
      setError('Veuillez entrer une adresse valide');
      return;
    }

    setLoading(true);
    setError(null);
    setAuditStatus(null);

    try {
      const response = await fetch('/api/audit/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du lancement de l\'audit');
      }

      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente...';
      case 'processing': return 'Analyse en cours...';
      case 'completed': return 'Audit terminé';
      case 'failed': return 'Échec de l\'audit';
      default: return 'Statut inconnu';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Auditeur de Smart Contracts
          </h1>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {!jobId ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse du contrat
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleStartAudit}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Lancement en cours...' : 'Lancer l\'audit'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  {auditStatus ? getStatusText(auditStatus.status) : 'Audit en attente...'}
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Job ID: {jobId}
                </p>
              </div>

              {auditStatus && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progression</span>
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
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800">
                        <strong>Erreur:</strong> {auditStatus.errorMessage}
                      </p>
                    </div>
                  )}

                  {auditStatus.status === 'completed' && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-sm text-green-800">
                        ✅ L'audit a été complété avec succès !
                      </p>
                    </div>
                  )}
                </div>
              )}

              {reportData && (
                <div className="space-y-6 mt-6">
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Rapport d'audit
                    </h3>
                    
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setShowJson(!showJson)}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                      >
                        {showJson ? 'Afficher Markdown' : 'Afficher JSON'}
                      </button>
                      <button
                        onClick={() => downloadFile(JSON.stringify(reportData.json, null, 2), `audit-report-${jobId}.json`, 'application/json')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Télécharger JSON
                      </button>
                      <button
                        onClick={() => downloadFile(reportData.markdown, `audit-report-${jobId}.md`, 'text/markdown')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Télécharger MD
                      </button>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto">
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
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">
                    Initialisation de l'audit...
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  setJobId(null);
                  setAuditStatus(null);
                  setReportData(null);
                  setAddress('');
                  setShowJson(false);
                }}
                className="w-full mt-4 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Nouvel audit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}