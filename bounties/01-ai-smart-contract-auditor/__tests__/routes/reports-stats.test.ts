import { NextRequest } from 'next/server';
import { GET } from '@/app/api/reports/stats/route';
import { getAuditReportStats } from '@/lib/database';

// Mock the dependencies
jest.mock('@/lib/database', () => ({
  getAuditReportStats: jest.fn()
}));

const mockGetAuditReportStats = getAuditReportStats as jest.MockedFunction<typeof getAuditReportStats>;

describe('/api/reports/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 400 for invalid address format', async () => {
      const request = new NextRequest('http://localhost/api/reports/stats?address=invalid-address');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid contract address format');
      expect(data.details).toBe('Address must be a valid Ethereum address starting with "0x"');
    });

    it('should return 400 for invalid time range', async () => {
      const request = new NextRequest('http://localhost/api/reports/stats?timeRange=invalid');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid time range parameter');
      expect(data.details).toBe('Time range must be one of: 24h, 7d, 30d, 90d, 1y, all');
    });

    it('should return global stats when no address provided', async () => {
      const mockStats = {
        total: 100,
        completed: 85,
        failed: 15,
        successRate: 85,
        totalFindings: 250,
        avgFindings: 2.9,
        avgProcessingTime: 30000,
        severityDistribution: {
          critical: 10,
          high: 25,
          medium: 75,
          low: 140
        }
      };
      
      mockGetAuditReportStats.mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost/api/reports/stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.global).toEqual(mockStats);
      expect(data.timestamp).toBeDefined();
      expect(mockGetAuditReportStats).toHaveBeenCalledWith();
    });

    it('should return address-specific stats', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockStats = {
        total: 5,
        completed: 4,
        failed: 1,
        successRate: 80,
        totalFindings: 12,
        avgFindings: 3,
        avgProcessingTime: 25000,
        severityDistribution: {
          critical: 1,
          high: 3,
          medium: 5,
          low: 3
        }
      };
      
      mockGetAuditReportStats.mockResolvedValue(mockStats);

      const request = new NextRequest(`http://localhost/api/reports/stats?address=${mockAddress}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.address).toEqual({
        address: mockAddress,
        ...mockStats
      });
      expect(data.timestamp).toBeDefined();
      expect(mockGetAuditReportStats).toHaveBeenCalledWith(mockAddress);
    });

    it('should handle database errors gracefully', async () => {
      mockGetAuditReportStats.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/reports/stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.global).toEqual({
        total: 0,
        completed: 0,
        failed: 0,
        successRate: 0,
        totalFindings: 0,
        avgFindings: 0,
        avgProcessingTime: 0,
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      });
    });

    it('should handle address stats fetch error', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockGetAuditReportStats.mockRejectedValue(new Error('Address not found'));

      const request = new NextRequest(`http://localhost/api/reports/stats?address=${mockAddress}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch address statistics');
    });

    it('should set appropriate cache headers', async () => {
      mockGetAuditReportStats.mockResolvedValue({
        total: 0,
        completed: 0,
        failed: 0,
        successRate: 0,
        totalFindings: 0,
        avgFindings: 0,
        avgProcessingTime: 0,
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 }
      });

      const request = new NextRequest('http://localhost/api/reports/stats');

      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, stale-while-revalidate=120');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});