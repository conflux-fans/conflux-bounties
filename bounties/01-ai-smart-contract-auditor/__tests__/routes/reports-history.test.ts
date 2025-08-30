import { NextRequest } from 'next/server';
import { GET } from '@/app/api/reports/[address]/history/route';
import { getAuditReportsByAddress, getAuditReportStats } from '@/lib/database';
import { validateAndNormalizeAddress } from '@/lib/addressUtils';

// Mock the dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/addressUtils');

const mockGetAuditReportsByAddress = getAuditReportsByAddress as jest.MockedFunction<typeof getAuditReportsByAddress>;
const mockGetAuditReportStats = getAuditReportStats as jest.MockedFunction<typeof getAuditReportStats>;
const mockValidateAndNormalizeAddress = validateAndNormalizeAddress as jest.MockedFunction<typeof validateAndNormalizeAddress>;

describe('/api/reports/[address]/history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 400 when address is invalid', async () => {
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: false,
        error: 'Invalid address format'
      });

      const request = new NextRequest('http://localhost/api/reports/invalid-address/history');
      const params = Promise.resolve({ address: 'invalid-address' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid contract address format');
      expect(data.details).toBe('Invalid address format');
      expect(mockValidateAndNormalizeAddress).toHaveBeenCalledWith('invalid-address');
    });

    it('should return 400 when status parameter is invalid', async () => {
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: '0x1234567890123456789012345678901234567890'
      });

      const request = new NextRequest('http://localhost/api/reports/0x1234567890123456789012345678901234567890/history?status=invalid');
      const params = Promise.resolve({ address: '0x1234567890123456789012345678901234567890' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
      expect(data.details).toBe('Invalid status parameter. Must be one of: completed, failed, processing');
    });

    it('should return audit history with default parameters', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      const mockReports = [
        {
          id: 'report-1',
          contract_address: mockAddress,
          audit_status: 'completed',
          findings_count: 3,
          critical_findings: 0,
          high_findings: 1,
          medium_findings: 2,
          low_findings: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          processing_time_ms: 30000,
          error_message: null,
          audit_engine_version: '1.0.0',
          static_analysis_tools: '["slither"]',
          report_json: '{"summary":{}}',
          report_markdown: '# Report 1'
        }
      ];

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: mockReports,
        total: 1
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.address).toBe(mockAddress);
      expect(data.reports).toHaveLength(1);
      expect(data.reports[0].id).toBe('report-1');
      expect(data.reports[0].auditStatus).toBe('completed');
      expect(data.reports[0].findingsCount).toBe(3);
      expect(data.reports[0].severityBreakdown).toEqual({
        critical: 0,
        high: 1,
        medium: 2,
        low: 0
      });
      expect(data.reports[0].reportData).toEqual({
        json: '{"summary":{}}',
        markdown: '# Report 1'
      });
      expect(data.pagination).toEqual({
        limit: 20,
        offset: 0,
        total: 1,
        hasMore: false
      });
      expect(data.stats).toBeUndefined();

      expect(mockGetAuditReportsByAddress).toHaveBeenCalledWith(
        mockAddress.toLowerCase(),
        21, // limit + 1
        0,  // offset
        undefined // status
      );
    });

    it('should return audit history with custom pagination', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      const mockReports = Array.from({ length: 6 }, (_, i) => ({
        id: `report-${i + 1}`,
        contract_address: mockAddress,
        audit_status: 'completed',
        findings_count: i,
        critical_findings: 0,
        high_findings: 0,
        medium_findings: 0,
        low_findings: i,
        created_at: `2024-01-0${i + 1}T00:00:00Z`,
        updated_at: `2024-01-0${i + 1}T01:00:00Z`,
        processing_time_ms: 10000,
        error_message: null,
        audit_engine_version: '1.0.0',
        static_analysis_tools: '[]',
        report_json: '{}',
        report_markdown: `# Report ${i + 1}`
      }));

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: mockReports,
        total: 25
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history?limit=5&offset=10`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reports).toHaveLength(5); // Trimmed from 6 to 5 due to limit
      expect(data.pagination).toEqual({
        limit: 5,
        offset: 10,
        total: 25,
        hasMore: true // Because we got 6 reports but limit is 5
      });

      expect(mockGetAuditReportsByAddress).toHaveBeenCalledWith(
        mockAddress.toLowerCase(),
        6, // limit + 1
        10, // offset
        undefined
      );
    });

    it('should filter by status', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      const mockReports = [
        {
          id: 'failed-report',
          contract_address: mockAddress,
          audit_status: 'failed',
          findings_count: 0,
          critical_findings: 0,
          high_findings: 0,
          medium_findings: 0,
          low_findings: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:30:00Z',
          processing_time_ms: null,
          error_message: 'Contract not found',
          audit_engine_version: '1.0.0',
          static_analysis_tools: '[]',
          report_json: null,
          report_markdown: null
        }
      ];

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: mockReports,
        total: 1
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history?status=failed`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reports).toHaveLength(1);
      expect(data.reports[0].auditStatus).toBe('failed');
      expect(data.reports[0].errorMessage).toBe('Contract not found');
      expect(data.reports[0].reportData).toBeUndefined();

      expect(mockGetAuditReportsByAddress).toHaveBeenCalledWith(
        mockAddress.toLowerCase(),
        21,
        0,
        'failed'
      );
    });

    it('should include stats when requested', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      const mockReports = [
        {
          id: 'report-with-stats',
          contract_address: mockAddress,
          audit_status: 'completed',
          findings_count: 2,
          critical_findings: 1,
          high_findings: 0,
          medium_findings: 1,
          low_findings: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          processing_time_ms: 25000,
          error_message: null,
          audit_engine_version: '1.0.0',
          static_analysis_tools: '["mythril"]',
          report_json: '{"findings":[]}',
          report_markdown: '# Stats Report'
        }
      ];

      const mockStats = {
        total: 5,
        completed: 4,
        failed: 1,
        avgFindings: 2.5,
        totalCritical: 2,
        totalHigh: 3,
        totalMedium: 5,
        totalLow: 1
      };

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: mockReports,
        total: 1
      });
      mockGetAuditReportStats.mockResolvedValue(mockStats);

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history?includeStats=true`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        total: 5,
        completed: 4,
        failed: 1,
        avgFindings: 2.5,
        severityDistribution: {
          critical: 2,
          high: 3,
          medium: 5,
          low: 1
        }
      });

      expect(mockGetAuditReportStats).toHaveBeenCalledWith(mockAddress.toLowerCase());
    });

    it('should handle stats fetch failure gracefully', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: [],
        total: 0
      });
      mockGetAuditReportStats.mockRejectedValue(new Error('Stats service unavailable'));

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history?includeStats=true`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeUndefined();
      expect(data.reports).toHaveLength(0);
    });

    it('should validate limit and offset bounds', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: [],
        total: 0
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history?limit=200&offset=-5`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(100); // Capped at 100
      expect(data.pagination.offset).toBe(0); // Minimum 0

      expect(mockGetAuditReportsByAddress).toHaveBeenCalledWith(
        mockAddress.toLowerCase(),
        101, // limit + 1
        0,   // offset
        undefined
      );
    });

    it('should return empty results for address with no reports', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: [],
        total: 0
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reports).toHaveLength(0);
      expect(data.pagination).toEqual({
        limit: 20,
        offset: 0,
        total: 0,
        hasMore: false
      });
    });

    it('should handle database errors', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      mockGetAuditReportsByAddress.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while fetching audit history');
      expect(data.type).toBe('audit_history_error');
      expect(data.address).toBe(mockAddress);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle validation errors as 400', async () => {
      mockValidateAndNormalizeAddress.mockImplementation(() => {
        throw new Error('Invalid address format');
      });

      const request = new NextRequest('http://localhost/api/reports/bad-address/history');
      const params = Promise.resolve({ address: 'bad-address' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid address format');
      expect(data.type).toBe('audit_history_error');
    });

    it('should set appropriate cache headers', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: [],
        total: 0
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=600');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle non-completed reports without reportData', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });

      const mockReports = [
        {
          id: 'processing-report',
          contract_address: mockAddress,
          audit_status: 'processing',
          findings_count: 0,
          critical_findings: 0,
          high_findings: 0,
          medium_findings: 0,
          low_findings: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:30:00Z',
          processing_time_ms: null,
          error_message: null,
          audit_engine_version: '1.0.0',
          static_analysis_tools: '[]',
          report_json: null,
          report_markdown: null
        }
      ];

      mockGetAuditReportsByAddress.mockResolvedValue({
        reports: mockReports,
        total: 1
      });

      const request = new NextRequest(`http://localhost/api/reports/${mockAddress}/history`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reports[0].auditStatus).toBe('processing');
      expect(data.reports[0].reportData).toBeUndefined();
    });
  });
});