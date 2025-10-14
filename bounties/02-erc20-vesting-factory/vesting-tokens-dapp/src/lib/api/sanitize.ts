// Sanitization utilities for API routes

/**
 * Sanitize a string to prevent XSS attacks
 * Simple implementation without DOMPurify for server-side
 * @param input String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return "";
  
  // Remove HTML tags and potentially dangerous characters
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>'"]/g, "") // Remove dangerous characters
    .trim();
}

/**
 * Sanitize optional fields in an object
 * @param obj Object with optional string fields
 * @param fields Array of field names to sanitize
 * @returns Object with sanitized fields
 */
export function sanitizeOptionalFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const sanitized = { ...obj };
  for (const field of fields) {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeString(sanitized[field] as string) as T[keyof T];
    }
  }
  return sanitized;
}

/**
 * Validate and sanitize Ethereum address
 * @param address Address to validate
 * @returns Lowercase address or throws error
 */
export function sanitizeAddress(address: string): string {
  const cleaned = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(cleaned)) {
    throw new Error("Invalid Ethereum address");
  }
  return cleaned;
}

/**
 * Validate and sanitize transaction hash
 * @param hash Transaction hash to validate
 * @returns Lowercase hash or throws error
 */
export function sanitizeTxHash(hash: string): string {
  const cleaned = hash.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(cleaned)) {
    throw new Error("Invalid transaction hash");
  }
  return cleaned;
}

/**
 * Sanitize numeric string (for amounts, etc.)
 * @param value Numeric string to sanitize
 * @returns Sanitized numeric string
 */
export function sanitizeNumericString(value: string): string {
  // Remove any non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, "");
  
  // Ensure only one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  
  return cleaned;
}

/**
 * Sanitize URL
 * @param url URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeURL(url: string | undefined | null): string {
  if (!url) return "";
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitize email address
 * @param email Email to sanitize
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return "";
  
  const cleaned = email.trim().toLowerCase();
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return "";
  }
  
  return cleaned;
}
