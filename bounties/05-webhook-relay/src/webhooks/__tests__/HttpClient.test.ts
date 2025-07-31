import axios from 'axios';
import { HttpClient } from '../HttpClient';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
    };
    
    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    httpClient = new HttpClient();
  });

  describe('constructor', () => {
    it('should create axios instance with validateStatus function', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        validateStatus: expect.any(Function),
      });

      // Test that validateStatus always returns true
      const createCall = mockedAxios.create.mock.calls[0]?.[0];
      expect(createCall).toBeDefined();
      
      if (createCall && createCall.validateStatus) {
        expect(createCall.validateStatus(200)).toBe(true);
        expect(createCall.validateStatus(404)).toBe(true);
        expect(createCall.validateStatus(500)).toBe(true);
      }
    });
  });

  describe('post', () => {
    const testUrl = 'https://example.com/webhook';
    const testData = { message: 'test' };
    const testHeaders = { 'Authorization': 'Bearer token' };
    const testTimeout = 5000;

    it('should successfully send POST request and return success result', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(testUrl, testData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        timeout: testTimeout,
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle HTTP error status codes', async () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Not found' },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      timeoutError.name = 'AxiosError';
      (timeoutError as any).code = 'ECONNABORTED';

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBeUndefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Request timeout after 5000ms');
    });

    it('should handle network errors with response', async () => {
      const networkError = {
        name: 'AxiosError',
        message: 'Network Error',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(networkError);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle network errors without response', async () => {
      const networkError = {
        name: 'AxiosError',
        message: 'Network Error',
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(networkError);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBeUndefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Network Error');
    });

    it('should handle axios errors without message', async () => {
      const networkError = {
        name: 'AxiosError',
        message: '', // Empty message to test fallback
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(networkError);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBeUndefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Unknown error');

      mockedAxios.isAxiosError.mockReturnValue(false);
      mockAxiosInstance.post.mockRejectedValue(unknownError);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBeUndefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle non-Error exceptions', async () => {
      const nonErrorException = 'String error';

      mockedAxios.isAxiosError.mockReturnValue(false);
      mockAxiosInstance.post.mockRejectedValue(nonErrorException);

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBeUndefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Unknown error');
    });

    it('should include Content-Type header by default', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await httpClient.post(testUrl, testData, {}, testTimeout);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(testUrl, testData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: testTimeout,
      });
    });

    it('should merge custom headers with default headers', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const customHeaders = {
        'Authorization': 'Bearer token',
        'X-Custom-Header': 'custom-value',
      };

      await httpClient.post(testUrl, testData, customHeaders, testTimeout);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(testUrl, testData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
          'X-Custom-Header': 'custom-value',
        },
        timeout: testTimeout,
      });
    });

    it('should measure response time accurately', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
      };

      // Mock a delay
      mockAxiosInstance.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 50))
      );

      const result = await httpClient.post(testUrl, testData, testHeaders, testTimeout);

      expect(result.responseTime).toBeGreaterThanOrEqual(40);
      expect(result.responseTime).toBeLessThan(100); // Should be close to 50ms
    });
  });
});