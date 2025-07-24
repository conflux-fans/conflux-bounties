import { startAudit, getAuditStatus } from '../lib/analysisEngine';
import { getContractSource } from '../lib/confluxScanClient';
import { generateReports } from '../lib/reportGenerator';

// Mock dependencies
jest.mock('../lib/confluxScanClient');
jest.mock('../lib/reportGenerator');

const mockGetContractSource = getContractSource as jest.MockedFunction<typeof getContractSource>;
const mockGenerateReports = generateReports as jest.MockedFunction<typeof generateReports>;

describe('analysisEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock default implementations
    mockGetContractSource.mockResolvedValue('contract TestContract { }');
    mockGenerateReports.mockReturnValue({
      json: { findings: [], summary: { total: 0 } },
      markdown: '# Test Report'
    });
  });

  describe('startAudit', () => {
    it('should return a UUID jobId', async () => {
      const jobId = await startAudit('0x1234567890123456789012345678901234567890');
      
      expect(jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should create a job with pending status', async () => {
      const jobId = await startAudit('0x1234567890123456789012345678901234567890');
      
      const job = await getAuditStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.status).toBe('pending');
      expect(job?.progress).toBe(0);
      expect(job?.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should process audit asynchronously', async () => {
      const jobId = await startAudit('0x1234567890123456789012345678901234567890');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const job = await getAuditStatus(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.progress).toBe(100);
      expect(job?.findings).toBeDefined();
      expect(job?.reports).toBeDefined();
    });

    it('should handle contract source fetch errors', async () => {
      mockGetContractSource.mockRejectedValue(new Error('Contract not found'));
      
      const jobId = await startAudit('0x1234567890123456789012345678901234567890');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const job = await getAuditStatus(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.errorMessage).toBe('Contract not found');
    });
  });

  describe('getAuditStatus', () => {
    it('should return null for non-existent job', async () => {
      const result = await getAuditStatus('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return job data for existing job', async () => {
      const jobId = await startAudit('0x1234567890123456789012345678901234567890');
      
      const job = await getAuditStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });
  });
});