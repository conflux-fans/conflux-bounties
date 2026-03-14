/** Options for retry behavior */
interface RetryOptions {
    /** Maximum number of attempts (default: 3) */
    maxAttempts?: number;
    /** Initial delay in ms (default: 1000) */
    baseDelayMs?: number;
    /** Maximum delay in ms (default: 30000) */
    maxDelayMs?: number;
}
/**
 * Retry an async function with exponential backoff and jitter.
 * Throws the last error if all attempts fail.
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
export {};
//# sourceMappingURL=retryWithBackoff.d.ts.map