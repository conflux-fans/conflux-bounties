import '@testing-library/jest-dom'

// Mock fetch globally
global.fetch = jest.fn()

// Mock Next.js imports
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url, options = {}) {
      this.url = url;
      this.method = options.method || 'GET';
      this.headers = new Headers(options.headers || {});
      this.body = options.body;
    }
  },
  NextResponse: {
    json: (data, options = {}) => {
      const response = new Response(JSON.stringify(data), {
        status: options.status || 200,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      return response;
    },
    stream: (stream, options = {}) => {
      return new Response(stream, {
        status: options.status || 200,
        headers: {
          'Content-Type': 'application/x-ndjson',
          ...options.headers
        }
      });
    }
  }
}));

// Mock Next.js server components for Node.js environment
Object.assign(global, {
  Request: class MockRequest {
    constructor(url, options = {}) {
      this.url = url
      this.method = options.method || 'GET'
      this.headers = new Headers(options.headers || {})
      this.body = options.body
    }
    
    async json() {
      return this.body ? JSON.parse(this.body) : {}
    }
    
    async text() {
      return this.body || ''
    }
  },
  
  Response: class MockResponse {
    constructor(body, options = {}) {
      this.body = body
      this.status = options.status || 200
      this.statusText = options.statusText || 'OK'
      this.headers = new Headers(options.headers || {})
      this.ok = this.status >= 200 && this.status < 300
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
    
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
    }
  },
  
  Headers: class MockHeaders {
    constructor(init = {}) {
      this._headers = new Map()
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), value)
        })
      }
    }
    
    get(key) {
      return this._headers.get(key.toLowerCase())
    }
    
    set(key, value) {
      this._headers.set(key.toLowerCase(), value)
      return this
    }
    
    has(key) {
      return this._headers.has(key.toLowerCase())
    }
    
    delete(key) {
      return this._headers.delete(key.toLowerCase())
    }
    
    entries() {
      return this._headers.entries()
    }
    
    keys() {
      return this._headers.keys()
    }
    
    values() {
      return this._headers.values()
    }
  },
  
  ReadableStream: class MockReadableStream {
    constructor(underlyingSource = {}) {
      this.underlyingSource = underlyingSource
    }
    
    getReader() {
      return {
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: jest.fn()
      }
    }
  }
})

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  jest.clearAllMocks()
  
  // Mock console methods but allow important test output
  console.log = jest.fn()
  console.error = jest.fn()
  console.warn = jest.fn()
})

afterEach(() => {
  // Restore console methods after each test
  console.log = originalConsoleLog
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})