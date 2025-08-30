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
  const [csvAddresses, setCsvAddresses] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{[key: string]: BatchAuditJob}>({});
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
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

    // Only accept Ethereum-style addresses (0x...)
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    
    if (ethRegex.test(addr)) {
      setAddressError('');
      setIsValidAddress(true);
    } else {
      setAddressError('Please enter a valid Ethereum address (0x...)');
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

  const isValidEVMAddress = (address: string): boolean => {
    const trimmed = address.trim();
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  };

  const processFile = async (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('Please upload a valid CSV file', 'error');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      const addresses: string[] = [];
      const invalidLines: string[] = [];

      lines.forEach((line, index) => {
        const address = line.trim();
        if (address) {
          if (isValidEVMAddress(address)) {
            addresses.push(address);
          } else {
            invalidLines.push(`Line ${index + 1}: ${address}`);
          }
        }
      });

      if (invalidLines.length > 0) {
        showToast(`Found ${invalidLines.length} invalid addresses. Only valid addresses will be processed.`, 'error');
      }

      if (addresses.length === 0) {
        showToast('No valid addresses found in CSV file', 'error');
        return;
      }

      if (addresses.length > 50) {
        showToast('Maximum 50 addresses allowed per batch', 'error');
        return;
      }

      setCsvFile(file);
      setCsvAddresses(addresses);
      showToast(`Successfully loaded ${addresses.length} valid addresses`, 'success');
    } catch (error) {
      showToast('Failed to read CSV file', 'error');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    await processFile(file);
  };

  const startBatchAudit = async () => {
    if (csvAddresses.length === 0) {
      showToast('Please upload a CSV file with addresses first', 'error');
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({});

    try {
      // Start batch audit
      const response = await fetch('/api/audit/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: csvAddresses,
          options: {
            maxConcurrency: 5
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start batch audit');
      }

      const { batchId } = await response.json();
      showToast(`Started batch audit for ${csvAddresses.length} addresses`, 'success');

      // Poll for batch status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/audit/batch?batchId=${batchId}`);
          if (!statusResponse.ok) {
            throw new Error('Failed to get batch status');
          }

          const batchStatus = await statusResponse.json();
          
          // Update progress for each job
          const progressMap: {[key: string]: BatchAuditJob} = {};
          batchStatus.results?.forEach((job: BatchAuditJob) => {
            progressMap[job.address] = job;
          });
          setBatchProgress(progressMap);

          // Check if batch is complete
          if (batchStatus.status === 'completed' || batchStatus.status === 'failed') {
            clearInterval(pollInterval);
            setIsBatchProcessing(false);
            showToast(
              `Batch audit completed: ${batchStatus.completedJobs} successful, ${batchStatus.failedJobs} failed`,
              batchStatus.failedJobs > 0 ? 'error' : 'success'
            );
          }
        } catch (error) {
          console.error('Failed to poll batch status:', error);
        }
      }, 2000); // Poll every 2 seconds

    } catch (error) {
      console.error('Batch audit failed:', error);
      showToast(error instanceof Error ? error.message : 'Batch audit failed', 'error');
      setIsBatchProcessing(false);
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
            <Link href="/features">
              <button className="btn btn-secondary btn-lg">
                <Shield className="icon-small mr-2" />
                Audit Features
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
          <div className="single-audit-container">
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
                        placeholder="0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
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

            {/* Audit Report */}
            {auditReport && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title gradient-text">Audit Report</h2>
                  <p className="card-description">
                    Security analysis completed for contract {address}
                  </p>
                </div>
                <div className="card-content">
                  <div className="report-summary">
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-label">Total Findings</span>
                        <span className="badge badge-info">{auditReport.findings?.length || 0}</span>
                      </div>
                      {auditReport.summary && Object.entries(auditReport.summary.severityCounts || {}).map(([severity, count]) => (
                        <div key={severity} className="stat-item">
                          <span className="stat-label">{severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
                          <span className={`badge badge-${severity}`}>{count as number}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="btn btn-primary btn-lg w-full mt-4"
                      onClick={() => window.open(`/audit/report/${auditReport.id}`, '_blank')}
                    >
                      <FileText className="icon-small mr-2" />
                      View Detailed Report
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                <div 
                  className={`upload-zone ${isDragOver ? 'upload-zone--dragover' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    <Upload className="icon-medium" />
                  </div>
                  <h3 className="upload-title">
                    {isDragOver ? 'Drop CSV file here' : 'Upload CSV File'}
                  </h3>
                  <p className="upload-description">
                    {isDragOver 
                      ? 'Release to upload your CSV file' 
                      : 'Drag and drop your CSV file here, or click to browse'
                    }
                  </p>
                  
                  <div className="format-example">
                    <h4 className="example-title">📄 CSV Format Example:</h4>
                    <pre className="format-code">0x62b0873055bf896dd869e172119871ac24aea305
0x8ba1f109551bd432803012645bd5c48c7da8bcd6
0x1f9840a85d5af5bf1d1762f925bdaddc4201f984</pre>
                    <p className="format-note">• Maximum 50 addresses per batch<br/>• One EVM address (0x...) per line<br/>• No column headers required</p>
                  </div>
                  
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="file-input-hidden"
                    id="csv-upload"
                    ref={(input) => {
                      if (input) {
                        (window as any).csvFileInput = input;
                      }
                    }}
                  />
                  <button 
                    className="btn btn-secondary btn-lg" 
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('csv-upload') as HTMLInputElement;
                      if (input) {
                        input.click();
                      }
                    }}
                  >
                    <Upload className="icon-small mr-2" />
                    Choose File
                  </button>
                  
                  {csvFile && csvAddresses.length > 0 && (
                    <div className="file-success">
                      <FileText className="icon-small" />
                      {csvFile.name} - {csvAddresses.length} addresses loaded
                    </div>
                  )}
                </div>

                {csvAddresses.length > 0 && (
                  <div className="csv-preview">
                    <h4 className="preview-title">📋 Loaded Addresses ({csvAddresses.length}/50):</h4>
                    <div className="address-list">
                      {csvAddresses.slice(0, 5).map((address, index) => (
                        <div key={index} className="address-item">
                          {address.slice(0, 10)}...{address.slice(-8)}
                        </div>
                      ))}
                      {csvAddresses.length > 5 && (
                        <div className="address-item more">
                          +{csvAddresses.length - 5} more addresses
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  disabled={csvAddresses.length === 0 || isBatchProcessing}
                  className="btn btn-primary btn-xl w-full mt-4"
                  onClick={startBatchAudit}
                >
                  <Shield className="icon-small mr-2" />
                  {isBatchProcessing ? (
                    <>
                      <div className="animate-spin mr-2">⟳</div>
                      Processing Batch...
                    </>
                  ) : (
                    `Start Batch Audit (${csvAddresses.length} addresses)`
                  )}
                </button>

                {Object.keys(batchProgress).length > 0 && (
                  <div className="batch-progress">
                    <h4 className="progress-title">🔄 Batch Progress:</h4>
                    <div className="progress-grid">
                      {Object.entries(batchProgress).map(([address, job]) => (
                        <div key={address} className={`progress-item progress-${job.status}`}>
                          <div className="progress-address">
                            {address.slice(0, 8)}...{address.slice(-6)}
                          </div>
                          <div className="progress-status">
                            {job.status === 'completed' && '✅'}
                            {job.status === 'failed' && '❌'}
                            {job.status === 'processing' && '⏳'}
                            {job.status === 'pending' && '⏱️'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Batch Reports */}
                {Object.values(batchProgress).some(job => job.status === 'completed' && job.report) && (
                  <div className="batch-reports">
                    <h4 className="reports-title">📄 Completed Reports:</h4>
                    <div className="reports-grid">
                      {Object.entries(batchProgress)
                        .filter(([_, job]) => job.status === 'completed' && job.report)
                        .map(([address, job]) => (
                          <div key={address} className="report-card">
                            <div className="report-header">
                              <h5 className="report-address">
                                {address.slice(0, 10)}...{address.slice(-8)}
                              </h5>
                              <span className="badge badge-success">Completed</span>
                            </div>
                            <div className="report-stats">
                              <div className="stat-item">
                                <span className="stat-label">Findings</span>
                                <span className="badge badge-info">{job.report?.findings?.length || 0}</span>
                              </div>
                              {job.report?.summary?.severityCounts && Object.entries(job.report.summary.severityCounts).map(([severity, count]) => (
                                (count as number) > 0 && (
                                  <div key={severity} className="stat-item">
                                    <span className="stat-label">{severity}</span>
                                    <span className={`badge badge-${severity}`}>{count as number}</span>
                                  </div>
                                )
                              ))}
                            </div>
                            <button
                              className="btn btn-primary btn-sm w-full mt-2"
                              onClick={() => window.open(`/audit/report/${job.report?.id}`, '_blank')}
                            >
                              <FileText className="icon-small mr-2" />
                              View Report
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
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
              <div className="card nested-card" style={{ background: 'var(--surface-light)' }}>
                <div className="nested-card-content">
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