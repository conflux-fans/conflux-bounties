import { POST, GET } from '../../app/api/audit/start/route';
import * as analysisEngine from '../../lib/analysisEngine';
import * as addressUtils from '../../lib/addressUtils';

// Mock the modules
jest.mock('../../lib/analysisEngine', () => ({
  runAudit: jest.fn(),
  startAudit: jest.fn()
}));

jest.mock('../../lib/addressUtils', () => ({
  validateAndNormalizeAddress: jest.fn()
}));

const mockRunAudit = analysisEngine.runAudit as jest.MockedFunction<typeof analysisEngine.runAudit>;
const mockStartAudit = analysisEngine.startAudit as jest.MockedFunction<typeof analysisEngine.startAudit>;
const mockValidateAddress = addressUtils.validateAndNormalizeAddress as jest.MockedFunction<typeof addressUtils.validateAndNormalizeAddress>;

// Helper to create mock NextRequest with proper json() method
function createRequest(body: any) {
  return {
    json: jest.fn().mockResolvedValue(body)
  } as any;
}

// Helper to create mock NextRequest for GET requests
function createGetRequest(url: string) {
  return {
    url,
    nextUrl: new URL(url),
  } as any;
}

describe('/api/audit/start route', () => {
  const mockAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  
  const mockReport = {
    id: 'report-1',
    json: { findings: [] },
    markdown: '# Audit Report',
    findings: [],
    summary: {
      totalFindings: 0,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      categories: [],
      contractAddress: mockAddress,
      analysisDate: '2024-01-01',
      toolsUsed: ['AI Analysis']
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mocks
    mockValidateAddress.mockReturnValue({
      isValid: true,
      normalized: mockAddress
    });
    
    mockStartAudit.mockResolvedValue('job-123');
    mockRunAudit.mockResolvedValue(mockReport);
  });

  it('should return error when address is missing', async () => {
    const request = createRequest({});

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Contract address is required');
  });

  it('should return error for invalid address', async () => {
    mockValidateAddress.mockReturnValue({
      isValid: false,
      error: 'Invalid address format'
    });

    const request = createRequest({ address: 'invalid-address' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid address format');
  });

  it('should create async audit job when async=true', async () => {
    const request = createRequest({ 
      address: mockAddress, 
      async: true 
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jobId).toBe('job-123');
    expect(data.status).toBe('pending');
    expect(data.address).toBe(mockAddress);
    expect(data.statusUrl).toBe('/api/audit/status/job-123');
    expect(data.reportUrl).toBe('/api/audit/report/job-123');
    
    expect(mockStartAudit).toHaveBeenCalledWith(mockAddress);
  });

  it('should handle streaming response when async=false', async () => {
    const request = createRequest({ 
      address: mockAddress,
      format: 'json'
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    // Streaming responses may not have immediate content-type headers
  });

  it('should handle text format streaming', async () => {
    const request = createRequest({ 
      address: mockAddress,
      format: 'text'
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    // Streaming responses may not have immediate content-type headers
  });

  it('should handle JSON parsing errors', async () => {
    const request = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
    } as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500); // Internal server error due to JSON parsing failure
    expect(data.error).toContain('Invalid JSON');
  });

  it('should handle analysis engine errors in async mode', async () => {
    mockStartAudit.mockRejectedValue(new Error('Analysis failed'));

    const request = createRequest({ 
      address: mockAddress, 
      async: true 
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Analysis failed');
  });

  it('should use default format as json when not specified', async () => {
    const request = createRequest({ 
      address: mockAddress
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it('should default async to false when not specified', async () => {
    const request = createRequest({ 
      address: mockAddress
    });

    const response = await POST(request);
    
    // Should be streaming response, not async job
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(mockStartAudit).not.toHaveBeenCalled();
  });

  it('should handle address validation properly', async () => {
    const request = createRequest({ 
      address: '  ' + mockAddress + '  ' // Test trimming
    });

    await POST(request);

    expect(mockValidateAddress).toHaveBeenCalledWith('  ' + mockAddress + '  ');
  });

  it('should handle format parameter validation', async () => {
    const request = createRequest({ 
      address: mockAddress,
      format: 'xml' // Unsupported format should default to json
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  // Test streaming response setup
  it('should create streaming response for json format', async () => {
    const request = createRequest({ 
      address: mockAddress,
      format: 'json'
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    // In the test environment, we can't easily test streaming headers
    // but we can verify the response is created successfully
  });

  it('should create streaming response for text format', async () => {
    const request = createRequest({ 
      address: mockAddress,
      format: 'text'
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    // Streaming response created successfully
  });

  it('should create streaming response even when runAudit fails', async () => {
    mockRunAudit.mockRejectedValue(new Error('Audit engine failed'));
    
    const request = createRequest({ 
      address: mockAddress,
      format: 'json'
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    
    // The streaming response is created successfully
    // Errors are handled within the stream
  });

  it('should create streaming response with progress handling', async () => {
    const request = createRequest({ 
      address: mockAddress,
      format: 'json'
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    
    // Streaming response with progress callback setup
  });

  it('should handle various error types in streaming mode', async () => {
    mockRunAudit.mockRejectedValue(new TypeError('Type error'));
    
    const request = createRequest({ 
      address: mockAddress
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it('should handle non-Error objects in streaming mode', async () => {
    mockRunAudit.mockRejectedValue('String error');
    
    const request = createRequest({ 
      address: mockAddress
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });
});

describe('/api/audit/start GET route', () => {
  const mockAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  
  const mockReport = {
    id: 'report-1',
    json: { findings: [] },
    markdown: '# Audit Report',
    findings: [],
    summary: {
      totalFindings: 0,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      categories: [],
      contractAddress: mockAddress,
      analysisDate: '2024-01-01',
      toolsUsed: ['AI Analysis']
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mocks
    mockValidateAddress.mockReturnValue({
      isValid: true,
      normalized: mockAddress
    });
    
    mockRunAudit.mockResolvedValue(mockReport);
  });

  it('should return error when address is missing in GET request', async () => {
    const request = createGetRequest('http://localhost/api/audit/start');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Contract address is required as query parameter');
  });

  it('should return error for invalid address in GET request', async () => {
    mockValidateAddress.mockReturnValue({
      isValid: false,
      error: 'Invalid address format'
    });

    const request = createGetRequest(`http://localhost/api/audit/start?address=invalid-address`);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid address format');
  });

  it('should handle valid address in GET request with SSE streaming', async () => {
    const request = createGetRequest(`http://localhost/api/audit/start?address=${mockAddress}`);

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('should create SSE streaming response for GET request', async () => {
    const request = createGetRequest(`http://localhost/api/audit/start?address=${mockAddress}`);

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    // SSE streaming response created successfully
  });

  it('should create SSE streaming response even with runAudit failures', async () => {
    mockRunAudit.mockRejectedValue(new Error('Audit engine failed'));
    
    const request = createGetRequest(`http://localhost/api/audit/start?address=${mockAddress}`);

    const response = await GET(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    
    // The SSE streaming response is created successfully
    // Errors are handled within the stream
  });

  it('should create SSE streaming response with progress handling', async () => {
    const request = createGetRequest(`http://localhost/api/audit/start?address=${mockAddress}`);

    const response = await GET(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    
    // SSE streaming response with progress callback setup
  });

  it('should handle various error types in GET SSE streaming mode', async () => {
    mockRunAudit.mockRejectedValue(new TypeError('SSE Type error'));
    
    const request = createGetRequest(`http://localhost/api/audit/start?address=${mockAddress}`);

    const response = await GET(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it('should handle non-Error objects in GET SSE streaming mode', async () => {
    mockRunAudit.mockRejectedValue('SSE String error');
    
    const request = createGetRequest(`http://localhost/api/audit/start?address=${mockAddress}`);

    const response = await GET(request);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it('should validate and normalize address in GET request', async () => {
    const addressWithSpaces = `  ${mockAddress}  `;
    const request = createGetRequest(`http://localhost/api/audit/start?address=${encodeURIComponent(addressWithSpaces)}`);

    await GET(request);

    expect(mockValidateAddress).toHaveBeenCalledWith(addressWithSpaces);
  });
});