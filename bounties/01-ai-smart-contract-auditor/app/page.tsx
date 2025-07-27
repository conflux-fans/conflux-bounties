'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, Shield, Zap, Clock, CheckCircle, AlertCircle, History } from 'lucide-react';
import Link from 'next/link';
import './page.css';

interface StreamMessage {
  type: 'start' | 'progress' | 'complete' | 'error';
  stage?: string;
  progress?: number;
  message: string;
  timestamp: string;
  data?: any;
  report?: any;
  error?: any;
}

interface StageMessage {
  id: string;
  stage: string;
  message: string;
  progress: number;
  timestamp: Date;
  type: 'start' | 'progress' | 'complete' | 'error';
}

interface BatchAuditJob {
  id: string;
  address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: string | Date;
  endTime?: string | Date;
  report?: any;
  error?: string;
}

type AuditMode = 'single' | 'batch' | 'api';

export default function SimplifiedAuditPage() {
  const [auditMode, setAuditMode] = useState<AuditMode>('single');
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [stageMessages, setStageMessages] = useState<StageMessage[]>([]);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | ''>('');

  // Simple toast function
  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage('');
      setToastType('');
    }, 3000);
  };

  // Address validation with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateAddress(address);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [address]);

  const validateAddress = (addr: string) => {
    if (!addr.trim()) {
      setAddressError('');
      setIsValidAddress(false);
      return;
    }

    // Conflux address validation
    const confluxRegex = /^cfx:[a-z0-9]{42}$/i;
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    
    if (confluxRegex.test(addr) || ethRegex.test(addr)) {
      setAddressError('');
      setIsValidAddress(true);
    } else {
      setAddressError('Please enter a valid Conflux (cfx:...) or Ethereum (0x...) address');
      setIsValidAddress(false);
    }
  };

  const startSingleAudit = async () => {
    if (!isValidAddress) {
      showToast('Please enter a valid contract address', 'error');
      return;
    }

    setIsAuditing(true);
    setCurrentProgress(0);
    setStageMessages([]);
    setAuditReport(null);

    try {
      const response = await fetch('/api/audit/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          address: address.trim(),
          format: 'json'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data: StreamMessage = JSON.parse(line);
              handleStreamMessage(data);
            } catch (parseError) {
              console.error('Failed to parse stream message:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Audit failed:', error);
      showToast(error instanceof Error ? error.message : 'Audit failed', 'error');
      setIsAuditing(false);
    }
  };

  const handleStreamMessage = (message: StreamMessage) => {
    const newMessage: StageMessage = {
      id: `${Date.now()}-${Math.random()}`,
      stage: message.stage || 'unknown',
      message: message.message,
      progress: message.progress || 0,
      timestamp: new Date(),
      type: message.type
    };

    if (message.type === 'progress') {
      setCurrentProgress(message.progress || 0);
    }

    setStageMessages(prev => {
      const updated = [...prev];
      const existingIndex = updated.findIndex(m => m.stage === newMessage.stage);
      
      if (existingIndex !== -1) {
        updated[existingIndex] = newMessage;
      } else {
        updated.push(newMessage);
      }
      
      return updated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });

    if (message.type === 'complete') {
      setAuditReport(message.report);
      setIsAuditing(false);
      setCurrentProgress(100);
      showToast('Audit completed successfully!', 'success');
    } else if (message.type === 'error') {
      setIsAuditing(false);
      showToast(`Audit failed: ${message.message}`, 'error');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      showToast('CSV file uploaded successfully', 'success');
    } else {
      showToast('Please upload a valid CSV file', 'error');
    }
  };

  const getCurrentStage = () => {
    if (currentProgress < 20) return 'Initializing';
    if (currentProgress < 40) return 'Fetching Contract';
    if (currentProgress < 60) return 'Static Analysis';
    if (currentProgress < 80) return 'AI Analysis';
    if (currentProgress < 100) return 'Generating Report';
    return 'Complete';
  };

  return (
    <div className="container">
      {/* Toast */}
      {toastMessage && (
        <div className={`toast toast-${toastType}`}>
          {toastMessage}
        </div>
      )}
      
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="icon-container">
            <div className="hero-icon">
              <Shield className="icon-large" />
            </div>
          </div>
          <h1 className="main-heading">
            Smart Contract
            <span className="gradient-text"> Auditor</span>
          </h1>
          <p className="hero-description">
            Advanced AI-powered security analysis for Conflux smart contracts. 
            Detect vulnerabilities, optimize gas usage, and ensure code quality.
          </p>
          <div className="hero-actions">
            <Link href="/history">
              <button className="btn btn-secondary btn-lg">
                <History className="icon-small mr-2" />
                View History
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="main-content">
        {/* Mode Selection */}
        <div className="mode-selection">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title gradient-text">Choose Audit Mode</h2>
              <p className="card-description">
                Select how you want to audit your smart contracts with our advanced AI system
              </p>
            </div>
            <div className="card-content">
              <div className="mode-grid">
                {[
                  { 
                    mode: 'single' as AuditMode, 
                    icon: <FileText className="icon-medium" />, 
                    title: 'Single Contract', 
                    description: 'Audit one contract at a time' 
                  },
                  { 
                    mode: 'batch' as AuditMode, 
                    icon: <Upload className="icon-medium" />, 
                    title: 'Batch Audit', 
                    description: 'Upload CSV file with multiple addresses' 
                  },
                  { 
                    mode: 'api' as AuditMode, 
                    icon: <Zap className="icon-medium" />, 
                    title: 'API Integration', 
                    description: 'Learn how to integrate via API' 
                  }
                ].map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => setAuditMode(option.mode)}
                    className={`mode-button ${
                      auditMode === option.mode ? 'mode-button-active' : ''
                    }`}
                  >
                    <div className="mode-header">
                      <div className={`mode-icon ${
                        auditMode === option.mode ? 'mode-icon-active' : ''
                      }`}>
                        {option.icon}
                      </div>
                      <h3 className="mode-title">{option.title}</h3>
                    </div>
                    <p className="mode-description">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Single Contract Audit */}
        {auditMode === 'single' && (
          <div className="audit-grid">
            <div className="audit-content">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title flex items-center gap-3">
                    <div className="progress-icon">
                      <Shield className="icon-medium" />
                    </div>
                    <span className="gradient-text">Contract Address</span>
                  </h2>
                  <p className="card-description">
                    Enter the smart contract address you want to audit with our advanced AI system
                  </p>
                </div>
                <div className="card-content">
                  <div className="address-section">
                    <div>
                      <label className="input-label">
                        Contract Address
                      </label>
                      <div className="input-container">
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="cfx:aak2rra2njvd77ezwjvx04kkds9fzagfe6ku8scz91 or 0x..."
                          className={`input-field ${
                            addressError ? 'input-error' : 
                            isValidAddress ? 'input-success' : ''
                          }`}
                          disabled={isAuditing}
                        />
                        <div className="input-icon">
                          {isValidAddress && (
                            <CheckCircle className="icon-small input-icon-success" />
                          )}
                          {addressError && (
                            <AlertCircle className="icon-small input-icon-error" />
                          )}
                        </div>
                      </div>
                      {addressError && (
                        <p className="error-message">
                          {addressError}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={startSingleAudit}
                      disabled={!isValidAddress || isAuditing}
                      className="btn btn-primary btn-xl w-full"
                    >
                      <Shield className="icon-small mr-2" />
                      {isAuditing ? (
                        <>
                          <div className="animate-spin mr-2">⟳</div>
                          Auditing Contract...
                        </>
                      ) : (
                        'Start Security Audit'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Progress */}
              {(isAuditing || stageMessages.length > 0) && (
                <div className="card progress-section">
                  <div className="card-header">
                    <div className="progress-header">
                      <div className="progress-icon">
                        <Clock className="icon-medium" />
                      </div>
                      <h2 className="progress-title gradient-text">Audit Progress</h2>
                      <span className="badge badge-info">{currentProgress}%</span>
                    </div>
                  </div>
                  <div className="card-content">
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${currentProgress}%` }}
                        />
                      </div>
                      <div className="progress-text">
                        {getCurrentStage()} - {currentProgress}% Complete
                      </div>
                    </div>
                    
                    {stageMessages.length > 0 && (
                      <div className="activity-log">
                        <h4 className="activity-title">Recent Activity</h4>
                        <div className="activity-messages">
                          {stageMessages.slice(-3).map((message) => (
                            <div
                              key={message.id}
                              className="activity-message"
                            >
                              <span className="activity-time">
                                {message.timestamp.toLocaleTimeString()}:
                              </span> {message.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="sidebar">
              {/* Features */}
              <div className="card">
                <div className="card-header">
                  <h3 className="sidebar-title gradient-text">Audit Features</h3>
                </div>
                <div className="card-content">
                  <div className="feature-list">
                    {[
                      { icon: '🔒', title: 'Security Analysis', desc: 'Detect reentrancy, overflow, and access control issues' },
                      { icon: '⛽', title: 'Gas Optimization', desc: 'Find inefficient patterns and optimize costs' },
                      { icon: '📝', title: 'Code Quality', desc: 'Improve readability and maintainability' },
                      { icon: '🤖', title: 'AI-Powered', desc: 'Advanced AI analysis with latest patterns' }
                    ].map((feature) => (
                      <div key={feature.title} className="feature-item">
                        <span className="feature-icon">{feature.icon}</span>
                        <div>
                          <h4 className="feature-title">{feature.title}</h4>
                          <p className="feature-desc">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              {auditReport && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="sidebar-title gradient-text">Audit Results</h3>
                  </div>
                  <div className="card-content">
                    <div className="feature-list">
                      <div className="flex items-center justify-space-between">
                        <span>Total Findings</span>
                        <span className="badge badge-info">{auditReport.findings?.length || 0}</span>
                      </div>
                      {auditReport.summary && Object.entries(auditReport.summary.severityCounts || {}).map(([severity, count]) => (
                        <div key={severity} className="flex items-center justify-space-between">
                          <span className={`badge badge-${severity}`}>{severity}</span>
                          <span>{count as number}</span>
                        </div>
                      ))}
                      <button
                        className="btn btn-primary btn-lg w-full mt-4"
                        onClick={() => window.open(`/audit/report/${auditReport.id}`, '_blank')}
                      >
                        <FileText className="icon-small mr-2" />
                        View Full Report
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch Audit Mode */}
        {auditMode === 'batch' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-3">
                <div className="progress-icon">
                  <Upload className="icon-medium" />
                </div>
                <span className="gradient-text">Batch Audit</span>
              </h2>
              <p className="card-description">
                Upload a CSV file containing multiple contract addresses for enterprise-scale batch processing
              </p>
            </div>
            <div className="card-content">
              <div className="text-center">
                <div className="upload-zone">
                  <div className="upload-icon">
                    <Upload className="icon-medium" />
                  </div>
                  <h3 className="upload-title">Upload CSV File</h3>
                  <p className="upload-description">
                    CSV should contain one address per row with an 'address' column header
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="file-input-hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload">
                    <button className="btn btn-secondary btn-lg">
                      <Upload className="icon-small mr-2" />
                      Choose File
                    </button>
                  </label>
                  {csvFile && (
                    <div className="file-success">
                      <FileText className="icon-small" />
                      {csvFile.name} uploaded successfully
                    </div>
                  )}
                </div>

                <button
                  disabled={!csvFile}
                  className="btn btn-primary btn-xl w-full mt-4"
                >
                  <Shield className="icon-small mr-2" />
                  Start Batch Audit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Integration Mode */}
        {auditMode === 'api' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-3">
                <div className="progress-icon">
                  <Zap className="icon-medium" />
                </div>
                <span className="gradient-text">API Integration</span>
              </h2>
              <p className="card-description">
                Learn how to integrate the audit service into your applications with our powerful API
              </p>
            </div>
            <div className="card-content">
              <p className="mb-4">
                Coming soon: Comprehensive API documentation and integration examples 
                for developers who want to integrate audit capabilities into their applications.
              </p>
              <div className="card" style={{ background: 'var(--surface-light)' }}>
                <div className="card-content">
                  <h4 className="mb-4">🚀 Features in Development</h4>
                  <ul className="feature-list">
                    <li className="feature-item">
                      <span>•</span>
                      <span>REST API endpoints for programmatic access</span>
                    </li>
                    <li className="feature-item">
                      <span>•</span>
                      <span>Webhook support for audit completion notifications</span>
                    </li>
                    <li className="feature-item">
                      <span>•</span>
                      <span>SDKs for popular programming languages</span>
                    </li>
                    <li className="feature-item">
                      <span>•</span>
                      <span>Rate limiting and authentication</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 24px;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        .toast-success {
          background: var(--accent-green);
        }
        .toast-error {
          background: var(--accent-red);
        }
        .justify-space-between {
          justify-content: space-between;
        }
      `}</style>
    </div>
  );
}