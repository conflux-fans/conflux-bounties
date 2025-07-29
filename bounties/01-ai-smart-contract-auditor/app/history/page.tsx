'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import './history.css';

interface AuditReport {
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
}

interface AuditHistoryResponse {
  address?: string;
  reports: AuditReport[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  stats?: {
    total: number;
    completed: number;
    failed: number;
    avgFindings: number;
    severityDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

type SortField = 'createdAt' | 'findingsCount' | 'contractAddress' | 'processingTimeMs';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'completed' | 'failed' | 'processing';

export default function SimplifiedHistoryPage() {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AuditHistoryResponse['stats'] | null>(null);

  const [searchAddress, setSearchAddress] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const reportsPerPage = 20;

  // Address validation function - EVM addresses only, case-insensitive, more flexible for search
  const isValidAddressForSearch = (address: string): boolean => {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    if (trimmed.length < 10) return false; // At least 10 characters for search (0x + 8 hex chars)
    
    // Allow partial EVM addresses (hex strings starting with 0x) - case insensitive
    return /^0x[a-fA-F0-9]{8,}$/i.test(trimmed);
  };

  // Validation for EVM addresses - case insensitive, matches API validation
  const isExactAddress = (address: string): boolean => {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    if (trimmed.length < 10) return false;
    // Accept EVM addresses with at least 8 hex characters (matches API validation)
    return /^0x[a-fA-F0-9]{8,}$/i.test(trimmed);
  };

  const fetchReports = async (address?: string, page = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      setError(null);

      const offset = (page - 1) * reportsPerPage;
      const params = new URLSearchParams({
        limit: String(reportsPerPage),
        offset: String(offset),
      });
      
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (!address) {
        // Map frontend sort fields to backend database column names
        const sortFieldMap: Record<SortField, string> = {
          'createdAt': 'created_at',
          'findingsCount': 'findings_count',
          'contractAddress': 'contract_address',
          'processingTimeMs': 'processing_time_ms'
        };
        params.append('sortBy', sortFieldMap[sortField]);
        params.append('sortOrder', sortOrder);
      }
      
      const url = address
        ? `/api/reports/${encodeURIComponent(address)}/history?${params}`
        : `/api/reports?${params}`;
        
      const res = await fetch(url);
      if (!res.ok) {
        let errorMessage = 'Failed to fetch audit history';
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = res.statusText || `HTTP ${res.status}`;
        }
        throw new Error(errorMessage);
      }
      
      const data: AuditHistoryResponse = await res.json();
      setReports(prev => (append ? [...prev, ...data.reports] : data.reports));
      setHasMore(data.pagination.hasMore);
      if (data.stats) setStats(data.stats);

      // Fetch global stats if not searching for specific address
      if (!address && !append) {
        try {
          const sres = await fetch('/api/reports/stats');
          if (sres.ok) {
            const sdata = await sres.json();
            setStats(sdata.global);
          }
        } catch (e) {
          // Ignore stats errors
          console.warn('Failed to fetch stats:', e);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Allow search for partial addresses or show all if empty
      const validSearchAddress = searchAddress && isValidAddressForSearch(searchAddress) ? searchAddress : undefined;
      fetchReports(validSearchAddress, 1, false);
    }, 800); // 800ms debounce to reduce API calls
    
    return () => clearTimeout(timeoutId);
  }, [searchAddress, statusFilter, sortField, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    // Allow search for partial addresses or show all if empty
    const validSearchAddress = searchAddress && isValidAddressForSearch(searchAddress) ? searchAddress : undefined;
    fetchReports(validSearchAddress, 1, false);
  };

  const handleLoadMore = () => {
    const next = currentPage + 1;
    setCurrentPage(next);
    // Allow search for partial addresses or show all if empty
    const validSearchAddress = searchAddress && isValidAddressForSearch(searchAddress) ? searchAddress : undefined;
    fetchReports(validSearchAddress, next, true);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'severity-critical',
      high: 'severity-high',
      medium: 'severity-medium',
      low: 'severity-low',
    };
    return colors[severity as keyof typeof colors] || 'severity-low';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      completed: <span className="icon-completed" />,
      failed: <span className="icon-failed" />,
      processing: <span className="icon-processing" />,
    };
    return icons[status as keyof typeof icons] || null;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="sort-icon-inactive" />;
    }
    return sortOrder === 'asc' ? (
      <span className="sort-icon-asc" />
    ) : (
      <span className="sort-icon-desc" />
    );
  };

  return (
    <div className="history-page">
      {/* Header */}
      <header className="history-header">
        <div className="header-left">
          <Link href="/" className="btn-back">
            <ArrowLeft className="icon-small" />
            Back to Home
          </Link>
          <h1 className="history-title">Audit History</h1>
        </div>
        <Link href="/" className="btn-new-audit">
          New Audit
        </Link>
      </header>

      {/* Search & Filters */}
      <form onSubmit={handleSearch} className="history-filters">
        <div className="search-input-container">
          <input
            type="text"
            value={searchAddress}
            onChange={e => setSearchAddress(e.target.value)}
            placeholder="Search by EVM contract address (0x...)"
            className="input-address"
          />
          {searchAddress && !isValidAddressForSearch(searchAddress) && (
            <small className="search-hint">
              Enter at least 10 characters (0x + 8 hex digits)
            </small>
          )}
          {searchAddress && isValidAddressForSearch(searchAddress) && !isExactAddress(searchAddress) && (
            <small className="search-hint">
              Searching for partial match...
            </small>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="select-status"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
        </select>
        <button type="submit" className="btn-search" disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {/* Statistics */}
      {stats && (
        <section className="history-stats">
          <h2 className="stats-title">
            {searchAddress ? `Stats for ${searchAddress}` : 'Global Statistics'}
          </h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Audits</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.failed}</div>
              <div className="stat-label">Failed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.avgFindings?.toFixed(1) ?? '0.0'}</div>
              <div className="stat-label">Avg Findings</div>
            </div>
          </div>
          
          <div className="stats-severity">
            <div className="severity-item">
              <span className="severity-label">Critical</span>
              <span className="severity-value">{stats.severityDistribution?.critical ?? 0}</span>
            </div>
            <div className="severity-item">
              <span className="severity-label">High</span>
              <span className="severity-value">{stats.severityDistribution?.high ?? 0}</span>
            </div>
            <div className="severity-item">
              <span className="severity-label">Medium</span>
              <span className="severity-value">{stats.severityDistribution?.medium ?? 0}</span>
            </div>
            <div className="severity-item">
              <span className="severity-label">Low</span>
              <span className="severity-value">{stats.severityDistribution?.low ?? 0}</span>
            </div>
          </div>
        </section>
      )}

      {/* Error State */}
      {error && (
        <div className="history-error">
          <p className="error-message">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && reports.length === 0 && (
        <div className="history-empty">
          <p>No audit reports found</p>
        </div>
      )}

      {/* Reports Table */}
      {reports.length > 0 && (
        <table className="history-table">
          <thead>
            <tr>
              <th>Status</th>
              <th onClick={() => handleSort('contractAddress')}>
                Contract Address {getSortIcon('contractAddress')}
              </th>
              <th onClick={() => handleSort('findingsCount')}>
                Findings {getSortIcon('findingsCount')}
              </th>
              <th>Severity Breakdown</th>
              <th onClick={() => handleSort('processingTimeMs')}>
                Duration {getSortIcon('processingTimeMs')}
              </th>
              <th onClick={() => handleSort('createdAt')}>
                Date {getSortIcon('createdAt')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => (
              <tr key={report.id} className="history-row">
                <td>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(report.auditStatus)}
                    <span className={`status-badge ${report.auditStatus}`}>
                      {report.auditStatus}
                    </span>
                  </div>
                </td>
                <td>
                  <code>{report.contractAddress}</code>
                </td>
                <td>
                  <strong>{report.findingsCount}</strong>
                </td>
                <td>
                  {(['critical', 'high', 'medium', 'low'] as const).map(severity =>
                    report.severityBreakdown[severity] > 0 ? (
                      <span
                        key={severity}
                        className={`severity-badge ${getSeverityColor(severity)}`}
                      >
                        {severity.charAt(0).toUpperCase()}: {report.severityBreakdown[severity]}
                      </span>
                    ) : null
                  )}
                </td>
                <td>
                  {report.processingTimeMs != null
                    ? `${(report.processingTimeMs / 1000).toFixed(1)}s`
                    : '-'}
                </td>
                <td>
                  {new Date(report.createdAt).toLocaleDateString()} <br />
                  <small>{new Date(report.createdAt).toLocaleTimeString()}</small>
                </td>
                <td className="actions-cell">
                  <Link href={`/audit/report/${report.id}`} className="action-link">
                    View Report
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="btn-load-more"
        >
          {loading ? 'Loading...' : 'Load More Reports'}
        </button>
      )}

      {/* Loading Spinner */}
      {loading && reports.length === 0 && (
        <div className="history-loading">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}