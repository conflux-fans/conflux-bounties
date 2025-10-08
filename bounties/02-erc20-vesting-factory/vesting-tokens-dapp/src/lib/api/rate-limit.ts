// Rate limiting utility for API routes
// Uses in-memory storage (for production, consider Redis)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Time window in milliseconds
   * @default 15 * 60 * 1000 (15 minutes)
   */
  windowMs?: number;
  /**
   * Maximum number of requests per window
   * @default 100
   */
  maxRequests?: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Rate limiter for API routes
 * @param identifier Unique identifier (e.g., IP address or user ID)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  const windowMs = config.windowMs ?? 15 * 60 * 1000; // 15 minutes
  const maxRequests = config.maxRequests ?? 100;

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: resetTime,
    };
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client identifier from request
 * Uses IP address or fallback to a default
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const ip =
    forwarded?.split(",")[0] ?? realIp ?? cfConnectingIp ?? "unknown";

  return ip;
}

/**
 * Rate limit middleware for POST routes
 * More restrictive for write operations
 */
export function rateLimitPOST(identifier: string): RateLimitResult {
  return rateLimit(identifier, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
  });
}

/**
 * Rate limit middleware for GET routes
 * Less restrictive for read operations
 */
export function rateLimitGET(identifier: string): RateLimitResult {
  return rateLimit(identifier, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 300, // 300 requests per 15 minutes
  });
}
