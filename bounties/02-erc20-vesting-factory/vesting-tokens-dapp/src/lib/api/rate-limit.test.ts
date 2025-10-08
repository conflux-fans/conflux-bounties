// Tests for rate limiting utility
import { rateLimit, rateLimitPOST, rateLimitGET, getClientIdentifier } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    // Clear rate limit store between tests
    jest.clearAllTimers();
  });

  it('should allow requests within limit', () => {
    const result1 = rateLimit('test-user', { maxRequests: 3, windowMs: 60000 });
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = rateLimit('test-user', { maxRequests: 3, windowMs: 60000 });
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = rateLimit('test-user', { maxRequests: 3, windowMs: 60000 });
    expect(result3.success).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should block requests exceeding limit', () => {
    rateLimit('test-user-2', { maxRequests: 2, windowMs: 60000 });
    rateLimit('test-user-2', { maxRequests: 2, windowMs: 60000 });
    
    const result = rateLimit('test-user-2', { maxRequests: 2, windowMs: 60000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    rateLimit('test-user-3', { maxRequests: 1, windowMs: 1000 });
    
    // Move time forward past the window
    jest.spyOn(Date, 'now').mockReturnValue(now + 2000);
    
    const result = rateLimit('test-user-3', { maxRequests: 1, windowMs: 1000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('should use default configuration', () => {
    const result = rateLimit('test-user-4');
    expect(result.success).toBe(true);
    expect(result.limit).toBe(100); // default maxRequests
  });
});

describe('rateLimitPOST', () => {
  it('should apply POST rate limits', () => {
    const result = rateLimitPOST('post-user');
    expect(result.success).toBe(true);
    expect(result.limit).toBe(100);
  });
});

describe('rateLimitGET', () => {
  it('should apply GET rate limits', () => {
    const result = rateLimitGET('get-user');
    expect(result.success).toBe(true);
    expect(result.limit).toBe(300);
  });
});

describe('getClientIdentifier', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
          return null;
        },
      },
    } as any;

    const identifier = getClientIdentifier(mockRequest);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should extract IP from x-real-ip header', () => {
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'x-real-ip') return '192.168.1.2';
          return null;
        },
      },
    } as any;

    const identifier = getClientIdentifier(mockRequest);
    expect(identifier).toBe('192.168.1.2');
  });

  it('should extract IP from cf-connecting-ip header', () => {
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'cf-connecting-ip') return '192.168.1.3';
          return null;
        },
      },
    } as any;

    const identifier = getClientIdentifier(mockRequest);
    expect(identifier).toBe('192.168.1.3');
  });

  it('should return unknown if no IP headers present', () => {
    const mockRequest = {
      headers: {
        get: () => null,
      },
    } as any;
    
    const identifier = getClientIdentifier(mockRequest);
    expect(identifier).toBe('unknown');
  });
});
