// Tests for sanitization utility
import {
  sanitizeString,
  sanitizeOptionalFields,
  sanitizeAddress,
  sanitizeTxHash,
  sanitizeNumericString,
  sanitizeURL,
  sanitizeEmail,
} from './sanitize';

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert(xss)');
    expect(sanitizeString('<div>Hello</div>')).toBe('Hello');
  });

  it('should remove dangerous characters', () => {
    expect(sanitizeString('Hello<>"\'')).toBe('Hello');
  });

  it('should trim whitespace', () => {
    expect(sanitizeString('  Hello  ')).toBe('Hello');
  });

  it('should handle empty/null input', () => {
    expect(sanitizeString('')).toBe('');
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });
});

describe('sanitizeOptionalFields', () => {
  it('should sanitize specified fields', () => {
    const obj = {
      name: 'John',
      description: '<script>xss</script>',
      website: 'https://example.com',
    };

    const result = sanitizeOptionalFields(obj, ['description']);
    expect(result.name).toBe('John');
    expect(result.description).toBe('xss');
    expect(result.website).toBe('https://example.com');
  });

  it('should handle non-string fields', () => {
    const obj = {
      name: 'John',
      age: 30,
      active: true,
    };

    const result = sanitizeOptionalFields(obj, ['age', 'active']);
    expect(result).toEqual(obj);
  });
});

describe('sanitizeAddress', () => {
  it('should validate and lowercase valid address', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbB';
    const result = sanitizeAddress(address);
    expect(result).toBe(address.toLowerCase());
  });

  it('should throw error for invalid address', () => {
    expect(() => sanitizeAddress('invalid')).toThrow('Invalid Ethereum address');
    expect(() => sanitizeAddress('0x123')).toThrow('Invalid Ethereum address');
    expect(() => sanitizeAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toThrow();
  });
});

describe('sanitizeTxHash', () => {
  it('should validate and lowercase valid transaction hash', () => {
    const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const result = sanitizeTxHash(hash);
    expect(result).toBe(hash.toLowerCase());
  });

  it('should throw error for invalid transaction hash', () => {
    expect(() => sanitizeTxHash('invalid')).toThrow('Invalid transaction hash');
    expect(() => sanitizeTxHash('0x123')).toThrow('Invalid transaction hash');
  });
});

describe('sanitizeNumericString', () => {
  it('should remove non-numeric characters', () => {
    expect(sanitizeNumericString('123abc456')).toBe('123456');
    expect(sanitizeNumericString('$1,234.56')).toBe('1234.56');
  });

  it('should handle multiple decimal points', () => {
    expect(sanitizeNumericString('123.45.67')).toBe('123.4567');
  });

  it('should preserve valid numeric strings', () => {
    expect(sanitizeNumericString('123.456')).toBe('123.456');
    expect(sanitizeNumericString('0.001')).toBe('0.001');
  });
});

describe('sanitizeURL', () => {
  it('should validate and return valid HTTP/HTTPS URLs', () => {
    expect(sanitizeURL('https://example.com')).toBe('https://example.com/');
    expect(sanitizeURL('http://example.com/path')).toBe('http://example.com/path');
  });

  it('should reject invalid protocols', () => {
    expect(sanitizeURL('javascript:alert(1)')).toBe('');
    expect(sanitizeURL('ftp://example.com')).toBe('');
  });

  it('should handle invalid URLs', () => {
    expect(sanitizeURL('not a url')).toBe('');
    expect(sanitizeURL('')).toBe('');
    expect(sanitizeURL(null)).toBe('');
    expect(sanitizeURL(undefined)).toBe('');
  });
});

describe('sanitizeEmail', () => {
  it('should validate and lowercase valid emails', () => {
    expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
    expect(sanitizeEmail('user+tag@domain.co.uk')).toBe('user+tag@domain.co.uk');
  });

  it('should reject invalid emails', () => {
    expect(sanitizeEmail('invalid')).toBe('');
    expect(sanitizeEmail('test@')).toBe('');
    expect(sanitizeEmail('@example.com')).toBe('');
    expect(sanitizeEmail('')).toBe('');
    expect(sanitizeEmail(null)).toBe('');
    expect(sanitizeEmail(undefined)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
  });
});
