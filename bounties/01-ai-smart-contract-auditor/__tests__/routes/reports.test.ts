import { GET } from '../../app/api/reports/route';
import * as database from '../../lib/database';

// Mock the database module
jest.mock('../../lib/database', () => ({
  getAllReports: jest.fn()
}));

const mockGetAllReports = database.getAllReports as jest.MockedFunction<typeof database.getAllReports>;

// Helper to create mock NextRequest
function createRequest(url: string) {
  return {
    url,
    nextUrl: new URL(url),
  } as any;
}

describe('/api/reports route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return reports with default parameters', async () => {
    const mockReports = [
      {
        id: 'report-1',
        contract_address: '0xtest',
        findings_count: 3,
        created_at: '2024-01-01T10:00:00Z',
        status: 'completed'
      }
    ];

    mockGetAllReports.mockResolvedValue({
      reports: mockReports,
      total: 1
    });

    const request = createRequest('http://localhost/api/reports');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // The API transforms the response, so check the structure
    expect(data.reports).toHaveLength(1);
    expect(data.reports[0]).toHaveProperty('contractAddress');
    expect(data.reports[0]).toHaveProperty('findingsCount');
    expect(data.reports[0]).toHaveProperty('createdAt');
    expect(data.pagination.limit).toBe(20);
    expect(data.pagination.offset).toBe(0);
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.hasMore).toBe(false);
  });

  it('should handle query parameters correctly', async () => {
    mockGetAllReports.mockResolvedValue({ reports: [], total: 0 });

    const request = createRequest('http://localhost/api/reports?limit=10&offset=5&status=completed&sortBy=created_at&sortOrder=desc');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.offset).toBe(5);
    expect(data.filters.status).toBe('completed');
    expect(data.filters.sortBy).toBe('created_at');
    expect(data.filters.sortOrder).toBe('desc');

    // Check that the database was called with the correct parameters
    expect(mockGetAllReports).toHaveBeenCalledWith(10, 5, 'created_at', 'desc');
  });

  it('should validate query parameters and return errors', async () => {
    const request = createRequest('http://localhost/api/reports?status=invalid');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid query parameters');
  });

  it('should handle database errors', async () => {
    mockGetAllReports.mockRejectedValue(new Error('Database connection failed'));

    const request = createRequest('http://localhost/api/reports');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it('should enforce limit bounds', async () => {
    mockGetAllReports.mockResolvedValue({ reports: [], total: 0 });

    const request = createRequest('http://localhost/api/reports?limit=999');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(100); // Max limit
  });

  it('should calculate hasMore correctly', async () => {
    mockGetAllReports.mockResolvedValue({ reports: [], total: 50 });

    const request = createRequest('http://localhost/api/reports?limit=10&offset=0');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.hasMore).toBe(true);
  });
});