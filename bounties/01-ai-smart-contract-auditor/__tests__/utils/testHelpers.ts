import { jest } from '@jest/globals';

// Test data factories
export const createMockFinding = (overrides = {}) => ({
  id: 'test-finding-1',
  category: 'Test Category',
  severity: 'medium' as const,
  swc_id: 'SWC-101',
  cwe_id: 'CWE-284',
  title: 'Test Finding',
  description: 'Test description',
  lines: [1, 2, 3],
  code_snippet: 'test code',
  codeSnippet: 'test code',
  location: 'test location',
  recommendation: 'Test recommendation',
  confidence: 0.8,
  impact: 'Test impact',
  accuracy: 0,
  ...overrides
});

export const createMockReport = (overrides = {}) => ({
  id: 'test-report-1',
  json: { findings: [], summary: { totalFindings: 0 } },
  markdown: '# Test Report',
  findings: [],
  summary: {
    totalFindings: 0,
    severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    categories: [],
    contractAddress: 'cfx:test',
    analysisDate: '2024-01-01T00:00:00Z',
    toolsUsed: ['AI Analysis']
  },
  ...overrides
});

// Mock factories
export const createMockFetch = () => {
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  return mockFetch;
};

export const createSuccessfulAIResponse = (findings: any[]) => ({
  ok: true,
  json: () => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify(findings)
      }
    }],
    usage: { total_tokens: 1000 }
  })
});

export const createFailedAIResponse = (status = 500, message = 'Server Error') => ({
  ok: false,
  status,
  text: () => Promise.resolve(message)
});

// Mock stream utilities
export const createMockReadableStream = (chunks: string[] = []) => {
  let index = 0;
  
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const pump = () => {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index++]));
          setTimeout(pump, 10);
        } else {
          controller.close();
        }
      };
      
      pump();
    }
  });
};

// Test utilities
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock Next.js Request/Response utilities
export const createMockRequest = (url: string, options: any = {}) => {
  const request = {
    url,
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
    json: async () => options.body || {},
    text: async () => options.body ? JSON.stringify(options.body) : '',
    body: options.body ? JSON.stringify(options.body) : undefined
  };
  return request as Request;
};

export const createMockNextRequest = (url: string, options: any = {}) => {
  const request = createMockRequest(url, options);
  // Add Next.js specific methods
  (request as any).nextUrl = new URL(url);
  return request;
};

// Mock progress callback
export const createMockProgressCallback = () => {
  const callback = jest.fn();
  callback.getCalls = () => callback.mock.calls.map(call => call[0]);
  callback.getStages = () => callback.mock.calls.map(call => call[0].stage);
  return callback;
};

// Environment helpers
export const setTestEnvironment = (env: Record<string, string>) => {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

export const cleanTestEnvironment = (keys: string[]) => {
  keys.forEach(key => {
    delete process.env[key];
  });
};

// Async test helpers
export const expectAsync = {
  toResolve: async (promise: Promise<any>) => {
    await expect(promise).resolves.toBeDefined();
  },
  
  toReject: async (promise: Promise<any>, errorMessage?: string) => {
    if (errorMessage) {
      await expect(promise).rejects.toThrow(errorMessage);
    } else {
      await expect(promise).rejects.toThrow();
    }
  }
};

// Mock module helpers
export const mockModule = (modulePath: string, mockImplementation: any) => {
  jest.doMock(modulePath, () => mockImplementation);
};

export const resetModuleMocks = () => {
  jest.resetModules();
};