import { NextRequest } from 'next/server';
import { GET } from '@/app/api/audit/report/[jobId]/route';
import { getAuditReportById } from '@/lib/database';
import { validateId } from '@/lib/idUtils';

// Mock the dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/idUtils');

const mockGetAuditReportById = getAuditReportById as jest.MockedFunction<typeof getAuditReportById>;
const mockValidateId = validateId as jest.MockedFunction<typeof validateId>;

describe('/api/audit/report/[jobId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 400 when jobId is not provided', async () => {
      const request = new NextRequest('http://localhost/api/audit/report/');
      const params = Promise.resolve({ jobId: '' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Job ID is required');
    });

    it('should return 400 when jobId format is invalid', async () => {
      mockValidateId.mockReturnValue({
        isValid: false,
        error: 'Invalid ID format'
      });

      const request = new NextRequest('http://localhost/api/audit/report/invalid-job-id');
      const params = Promise.resolve({ jobId: 'invalid-job-id' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid job ID format');
      expect(data.details).toBe('Job ID must be a valid UUID or cuid format');
      expect(mockValidateId).toHaveBeenCalledWith('invalid-job-id');
    });

    it('should return 404 when report is not found', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      mockGetAuditReportById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/audit/report/valid-job-id');
      const params = Promise.resolve({ jobId: 'valid-job-id' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Audit report not found');
      expect(data.details).toBe('No audit report found with job ID: valid-job-id');
      expect(mockGetAuditReportById).toHaveBeenCalledWith('valid-job-id');
    });

    it('should return 400 when audit is not completed', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReport = {
        id: 'job-123',
        audit_status: 'running',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: null,
        report_markdown: null
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-123');
      const params = Promise.resolve({ jobId: 'job-123' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Audit is not completed yet');
      expect(data.details).toBe('Current status: running');
      expect(data.status).toBe('running');
    });

    it('should return 400 with error message when audit failed', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReport = {
        id: 'job-failed',
        audit_status: 'failed',
        error_message: 'Contract not found',
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: null,
        report_markdown: null
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-failed');
      const params = Promise.resolve({ jobId: 'job-failed' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Audit is not completed yet');
      expect(data.details).toBe('Current status: failed');
      expect(data.status).toBe('failed');
      expect(data.errorMessage).toBe('Contract not found');
    });

    it('should return 404 when report data is missing', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReport = {
        id: 'job-completed-no-data',
        audit_status: 'completed',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: null,
        report_markdown: null
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-completed-no-data');
      const params = Promise.resolve({ jobId: 'job-completed-no-data' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Audit report data is not available');
      expect(data.details).toBe('The audit completed but report content is missing');
    });

    it('should return 500 when report JSON is corrupted', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReport = {
        id: 'job-corrupted',
        audit_status: 'completed',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: 'invalid-json{',
        report_markdown: '# Report'
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-corrupted');
      const params = Promise.resolve({ jobId: 'job-corrupted' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Report data is corrupted');
      expect(data.details).toBe('Failed to parse audit report JSON data');
    });

    it('should return successful report with all data', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReportJson = {
        summary: { riskScore: 7, totalFindings: 5 },
        findings: [
          { severity: 'high', title: 'Critical vulnerability', description: 'Test finding' }
        ]
      };
      const mockReport = {
        id: 'job-success',
        audit_status: 'completed',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: JSON.stringify(mockReportJson),
        report_markdown: '# Audit Report\n\nTest report content',
        created_at: new Date('2024-01-01T00:00:00Z'),
        findings_count: 5,
        critical_findings: 1,
        high_findings: 2,
        medium_findings: 1,
        low_findings: 1,
        processing_time_ms: 30000,
        audit_engine_version: '1.0.0',
        static_analysis_tools: JSON.stringify(['slither', 'mythril'])
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-success');
      const params = Promise.resolve({ jobId: 'job-success' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.json).toEqual(mockReportJson);
      expect(data.markdown).toBe('# Audit Report\n\nTest report content');
      expect(data.jobId).toBe('job-success');
      expect(data.address).toBe('0x1234567890123456789012345678901234567890');
      expect(data.completedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(data.metadata.findingsCount).toBe(5);
      expect(data.metadata.severityBreakdown).toEqual({
        critical: 1,
        high: 2,
        medium: 1,
        low: 1
      });
      expect(data.metadata.processingTimeMs).toBe(30000);
      expect(data.metadata.auditEngineVersion).toBe('1.0.0');
      expect(data.metadata.staticAnalysisTools).toEqual(['slither', 'mythril']);
      
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle report with object-type JSON data', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReportJson = {
        summary: { riskScore: 3, totalFindings: 2 },
        findings: []
      };
      const mockReport = {
        id: 'job-object-json',
        audit_status: 'completed',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: mockReportJson, // Already an object
        report_markdown: '# Clean Report',
        created_at: new Date('2024-01-01T00:00:00Z'),
        findings_count: 0,
        critical_findings: 0,
        high_findings: 0,
        medium_findings: 0,
        low_findings: 0,
        processing_time_ms: 15000,
        audit_engine_version: '1.1.0',
        static_analysis_tools: null
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-object-json');
      const params = Promise.resolve({ jobId: 'job-object-json' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.json).toEqual(mockReportJson);
      expect(data.metadata.staticAnalysisTools).toBeNull();
    });

    it('should handle corrupted static analysis tools JSON gracefully', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReportJson = { summary: { riskScore: 1 }, findings: [] };
      const mockReport = {
        id: 'job-corrupted-tools',
        audit_status: 'completed',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: JSON.stringify(mockReportJson),
        report_markdown: '# Report',
        created_at: new Date('2024-01-01T00:00:00Z'),
        findings_count: 0,
        critical_findings: 0,
        high_findings: 0,
        medium_findings: 0,
        low_findings: 0,
        processing_time_ms: 5000,
        audit_engine_version: '1.0.0',
        static_analysis_tools: 'invalid-json{'
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-corrupted-tools');
      const params = Promise.resolve({ jobId: 'job-corrupted-tools' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.staticAnalysisTools).toEqual([]);
    });

    it('should return 500 when database throws an error', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      mockGetAuditReportById.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/audit/report/job-db-error');
      const params = Promise.resolve({ jobId: 'job-db-error' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while fetching audit report');
      expect(data.type).toBe('audit_report_error');
      expect(data.jobId).toBe('job-db-error');
      expect(data.timestamp).toBeDefined();
    });

    it('should handle missing markdown report gracefully', async () => {
      mockValidateId.mockReturnValue({ isValid: true });
      const mockReport = {
        id: 'job-no-markdown',
        audit_status: 'completed',
        error_message: null,
        contract_address: '0x1234567890123456789012345678901234567890',
        report_json: JSON.stringify({ summary: {}, findings: [] }),
        report_markdown: '',  // Empty markdown
        created_at: new Date('2024-01-01T00:00:00Z'),
        findings_count: 0,
        critical_findings: 0,
        high_findings: 0,
        medium_findings: 0,
        low_findings: 0,
        processing_time_ms: 1000,
        audit_engine_version: '1.0.0',
        static_analysis_tools: '[]'
      };
      mockGetAuditReportById.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost/api/audit/report/job-no-markdown');
      const params = Promise.resolve({ jobId: 'job-no-markdown' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Audit report data is not available');
    });
  });
});