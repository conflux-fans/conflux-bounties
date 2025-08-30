import { POST, GET } from '../../app/api/audit/batch/route';
import * as analysisEngine from '../../lib/analysisEngine';

// Mock the analysis engine
jest.mock('../../lib/analysisEngine', () => ({
  runAudit: jest.fn()
}));

const mockRunAudit = analysisEngine.runAudit as jest.MockedFunction<typeof analysisEngine.runAudit>;

// Helper to create mock NextRequest
function createRequest(body?: any, url?: string) {
  return {
    json: body ? jest.fn().mockResolvedValue(body) : undefined,
    url: url || 'http://localhost/api/audit/batch',
    nextUrl: new URL(url || 'http://localhost/api/audit/batch'),
  } as any;
}

describe('/api/audit/batch route', () => {
  const mockAddresses = [
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    '0xA0b86a33E6c5c4B8F2C3d6E7a2b8C5D4E3F2G1H0'
  ];
  
  const mockReport = {
    id: 'report-1',
    json: { findings: [] },
    markdown: '# Audit Report',
    findings: [],
    summary: {
      totalFindings: 0,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      categories: [],
      contractAddress: mockAddresses[0],
      analysisDate: '2024-01-01',
      toolsUsed: ['AI Analysis']
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAudit.mockResolvedValue(mockReport);
  });

  describe('POST', () => {
    it('should return error when addresses array is missing', async () => {
      const request = createRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('addresses must be a non-empty array');
    });

    it('should return error when addresses array is empty', async () => {
      const request = createRequest({ addresses: [] });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('At least one address is required');
    });

    it('should return error when too many addresses provided', async () => {
      const tooManyAddresses = Array(51).fill('0xdAC17F958D2ee523a2206206994597C13D831ec7');
      
      const request = createRequest({ addresses: tooManyAddresses });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Maximum 50 addresses allowed per batch');
    });

    it('should start batch audit successfully', async () => {
      const request = createRequest({ addresses: mockAddresses });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.batchId).toBeDefined();
      expect(data.jobIds).toHaveLength(2);
      expect(data.status).toBe('started');
      expect(data.totalJobs).toBe(2);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle custom options', async () => {
      const request = createRequest({ 
        addresses: mockAddresses,
        options: {
          maxConcurrency: 2,
          includeResults: true
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.batchId).toBeDefined();
      expect(data.totalJobs).toBe(2);
    });

    it('should handle JSON parsing errors', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should validate individual addresses', async () => {
      const invalidAddresses = ['invalid-address', '0xinvalid'];
      
      const request = createRequest({ addresses: invalidAddresses });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid address');
    });

    it('should use default options when not provided', async () => {
      const request = createRequest({ addresses: [mockAddresses[0]] });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.batchId).toBeDefined();
    });

    it('should handle internal errors gracefully', async () => {
      // Mock an internal error during batch processing
      const request = createRequest(null); // null body to trigger error

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET', () => {
    it('should return error when batchId is missing', async () => {
      const request = createRequest(undefined, 'http://localhost/api/audit/batch');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('batchId');
    });

    it('should return error for non-existent batch', async () => {
      const request = createRequest(undefined, 'http://localhost/api/audit/batch?batchId=non-existent');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Batch');
      expect(data.error).toContain('not found');
    });

    it('should handle batch creation and retrieval flow', async () => {
      // First create a batch
      const postRequest = createRequest({ addresses: [mockAddresses[0]] });
      const postResponse = await POST(postRequest);
      const postData = await postResponse.json();
      const batchId = postData.batchId;

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Then try to get batch results
      const getRequest = createRequest(undefined, `http://localhost/api/audit/batch?batchId=${batchId}`);
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.batchId).toBe(batchId);
      expect(getData.totalJobs).toBeDefined();
      expect(getData.results).toBeDefined();
      expect(Array.isArray(getData.results)).toBe(true);
    });

    it('should handle malformed batchId parameter', async () => {
      const request = createRequest(undefined, 'http://localhost/api/audit/batch?batchId=');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('batchId');
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent batch operations', async () => {
      const requests = [
        createRequest({ addresses: [mockAddresses[0]] }),
        createRequest({ addresses: [mockAddresses[1]] })
      ];

      const responses = await Promise.all(requests.map(req => POST(req)));
      
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.batchId).toBeDefined();
      }
    });

    it('should handle analysis failures in batch processing', async () => {
      mockRunAudit.mockRejectedValue(new Error('Analysis failed'));

      const request = createRequest({ addresses: [mockAddresses[0]] });

      // Should still create batch successfully even if individual audits fail
      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });
});