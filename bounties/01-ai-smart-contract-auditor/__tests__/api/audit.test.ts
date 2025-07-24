import { POST } from '../../app/api/audit/start/route';
import { GET as StatusGET } from '../../app/api/audit/status/[jobId]/route';
import { GET as ReportGET } from '../../app/api/audit/report/[jobId]/route';
import { startAudit, getAuditStatus } from '../../lib/analysisEngine';
import { NextRequest } from 'next/server';

// Mock the analysisEngine module
jest.mock('../../lib/analysisEngine');

const mockStartAudit = startAudit as jest.MockedFunction<typeof startAudit>;
const mockGetAuditStatus = getAuditStatus as jest.MockedFunction<typeof getAuditStatus>;

describe('Audit API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/audit/start', () => {
    describe('POST', () => {
      it('should start audit and return jobId', async () => {
        const mockJobId = 'test-job-id';
        mockStartAudit.mockResolvedValue(mockJobId);

        const request = new NextRequest('http://localhost:3000/api/audit/start', {
          method: 'POST',
          body: JSON.stringify({ address: '0x1234567890123456789012345678901234567890' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobId).toBe(mockJobId);
        expect(mockStartAudit).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
      });

      it('should return 400 when address is missing', async () => {
        const request = new NextRequest('http://localhost:3000/api/audit/start', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Address is required');
        expect(mockStartAudit).not.toHaveBeenCalled();
      });

      it('should return 500 on startAudit error', async () => {
        mockStartAudit.mockRejectedValue(new Error('Database error'));

        const request = new NextRequest('http://localhost:3000/api/audit/start', {
          method: 'POST',
          body: JSON.stringify({ address: '0x1234567890123456789012345678901234567890' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
      });
    });
  });

  describe('/api/audit/status/[jobId]', () => {
    describe('GET', () => {
      it('should return audit status', async () => {
        const mockJob = {
          id: 'test-job-id',
          address: '0x1234567890123456789012345678901234567890',
          status: 'processing' as const,
          progress: 50,
          createdAt: new Date()
        };

        mockGetAuditStatus.mockResolvedValue(mockJob);

        const request = new NextRequest('http://localhost:3000/api/audit/status/test-job-id');
        const params = { jobId: 'test-job-id' };

        const response = await StatusGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe('processing');
        expect(data.progress).toBe(50);
        expect(mockGetAuditStatus).toHaveBeenCalledWith('test-job-id');
      });

      it('should return 404 when job not found', async () => {
        mockGetAuditStatus.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/audit/status/non-existent');
        const params = { jobId: 'non-existent' };

        const response = await StatusGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Job not found');
      });

      it('should include reportUrl when status is completed', async () => {
        const mockJob = {
          id: 'test-job-id',
          address: '0x1234567890123456789012345678901234567890',
          status: 'completed' as const,
          progress: 100,
          createdAt: new Date()
        };

        mockGetAuditStatus.mockResolvedValue(mockJob);

        const request = new NextRequest('http://localhost:3000/api/audit/status/test-job-id');
        const params = { jobId: 'test-job-id' };

        const response = await StatusGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.reportUrl).toBe('/api/audit/report/test-job-id');
      });

      it('should include errorMessage when present', async () => {
        const mockJob = {
          id: 'test-job-id',
          address: '0x1234567890123456789012345678901234567890',
          status: 'failed' as const,
          progress: 30,
          createdAt: new Date(),
          errorMessage: 'Contract not found'
        };

        mockGetAuditStatus.mockResolvedValue(mockJob);

        const request = new NextRequest('http://localhost:3000/api/audit/status/test-job-id');
        const params = { jobId: 'test-job-id' };

        const response = await StatusGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.errorMessage).toBe('Contract not found');
      });
    });
  });

  describe('/api/audit/report/[jobId]', () => {
    describe('GET', () => {
      it('should return report data', async () => {
        const mockReports = {
          json: { findings: [], summary: { total: 0 } },
          markdown: '# Test Report'
        };

        const mockJob = {
          id: 'test-job-id',
          address: '0x1234567890123456789012345678901234567890',
          status: 'completed' as const,
          progress: 100,
          createdAt: new Date(),
          reports: mockReports
        };

        mockGetAuditStatus.mockResolvedValue(mockJob);

        const request = new NextRequest('http://localhost:3000/api/audit/report/test-job-id');
        const params = { jobId: 'test-job-id' };

        const response = await ReportGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.json).toEqual(mockReports.json);
        expect(data.markdown).toBe(mockReports.markdown);
      });

      it('should return 404 when job not found', async () => {
        mockGetAuditStatus.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/audit/report/non-existent');
        const params = { jobId: 'non-existent' };

        const response = await ReportGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Job not found');
      });

      it('should return 404 when report not available', async () => {
        const mockJob = {
          id: 'test-job-id',
          address: '0x1234567890123456789012345678901234567890',
          status: 'processing' as const,
          progress: 50,
          createdAt: new Date()
        };

        mockGetAuditStatus.mockResolvedValue(mockJob);

        const request = new NextRequest('http://localhost:3000/api/audit/report/test-job-id');
        const params = { jobId: 'test-job-id' };

        const response = await ReportGET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Report not available');
      });
    });
  });
});