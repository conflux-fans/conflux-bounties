import { NextRequest } from 'next/server';
import { GET } from '@/app/api/audit/status/[jobId]/route';
import { getAuditStatus } from '@/lib/analysisEngine';

// Mock the dependencies
jest.mock('@/lib/analysisEngine');

const mockGetAuditStatus = getAuditStatus as jest.MockedFunction<typeof getAuditStatus>;

describe('/api/audit/status/[jobId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 400 when jobId is not provided', async () => {
      const request = new NextRequest('http://localhost/api/audit/status/');
      const params = Promise.resolve({ jobId: '' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Job ID is required');
    });

    it('should return 404 when job is not found', async () => {
      mockGetAuditStatus.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/audit/status/non-existent-job');
      const params = Promise.resolve({ jobId: 'non-existent-job' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Audit job with ID 'non-existent-job' was not found. Please check the Job ID and try again.");
      expect(mockGetAuditStatus).toHaveBeenCalledWith('non-existent-job');
    });

    it('should return job status when job is pending', async () => {
      const mockJob = {
        status: 'pending' as const,
        progress: 0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        address: '0x1234567890123456789012345678901234567890'
      };
      mockGetAuditStatus.mockResolvedValue(mockJob);

      const request = new NextRequest('http://localhost/api/audit/status/job-123');
      const params = Promise.resolve({ jobId: 'job-123' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('pending');
      expect(data.progress).toBe(0);
      expect(data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(data.address).toBe('0x1234567890123456789012345678901234567890');
      expect(data.reportUrl).toBeUndefined();
      expect(data.errorMessage).toBeUndefined();
    });

    it('should return job status when job is in progress', async () => {
      const mockJob = {
        status: 'running' as const,
        progress: 45,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        address: '0x1234567890123456789012345678901234567890'
      };
      mockGetAuditStatus.mockResolvedValue(mockJob);

      const request = new NextRequest('http://localhost/api/audit/status/job-456');
      const params = Promise.resolve({ jobId: 'job-456' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('running');
      expect(data.progress).toBe(45);
      expect(data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(data.address).toBe('0x1234567890123456789012345678901234567890');
      expect(data.reportUrl).toBeUndefined();
      expect(data.errorMessage).toBeUndefined();
    });

    it('should return job status with reportUrl when job is completed', async () => {
      const mockJob = {
        status: 'completed' as const,
        progress: 100,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        address: '0x1234567890123456789012345678901234567890'
      };
      mockGetAuditStatus.mockResolvedValue(mockJob);

      const request = new NextRequest('http://localhost/api/audit/status/job-789');
      const params = Promise.resolve({ jobId: 'job-789' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('completed');
      expect(data.progress).toBe(100);
      expect(data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(data.address).toBe('0x1234567890123456789012345678901234567890');
      expect(data.reportUrl).toBe('/api/audit/report/job-789');
      expect(data.errorMessage).toBeUndefined();
    });

    it('should return job status with errorMessage when job failed', async () => {
      const mockJob = {
        status: 'failed' as const,
        progress: 25,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        address: '0x1234567890123456789012345678901234567890',
        errorMessage: 'Contract not found on blockchain'
      };
      mockGetAuditStatus.mockResolvedValue(mockJob);

      const request = new NextRequest('http://localhost/api/audit/status/job-failed');
      const params = Promise.resolve({ jobId: 'job-failed' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('failed');
      expect(data.progress).toBe(25);
      expect(data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(data.address).toBe('0x1234567890123456789012345678901234567890');
      expect(data.errorMessage).toBe('Contract not found on blockchain');
      expect(data.reportUrl).toBeUndefined();
    });

    it('should return 500 when getAuditStatus throws an error', async () => {
      mockGetAuditStatus.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/audit/status/job-error');
      const params = Promise.resolve({ jobId: 'job-error' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve audit status. Please try again later.');
      expect(mockGetAuditStatus).toHaveBeenCalledWith('job-error');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetAuditStatus.mockRejectedValue('String error');

      const request = new NextRequest('http://localhost/api/audit/status/job-string-error');
      const params = Promise.resolve({ jobId: 'job-string-error' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve audit status. Please try again later.');
    });

    it('should handle jobs with all optional fields', async () => {
      const mockJob = {
        status: 'completed' as const,
        progress: 100,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        address: '0x1234567890123456789012345678901234567890',
        errorMessage: null
      };
      mockGetAuditStatus.mockResolvedValue(mockJob);

      const request = new NextRequest('http://localhost/api/audit/status/job-complete');
      const params = Promise.resolve({ jobId: 'job-complete' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('completed');
      expect(data.reportUrl).toBe('/api/audit/report/job-complete');
      expect(data.errorMessage).toBeUndefined();
    });
  });
});