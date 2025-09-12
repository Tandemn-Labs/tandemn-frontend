// Retry mechanism with exponential backoff for Clerk API calls

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly originalError: any) {
    super(message);
    this.name = 'RetryableError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    backoffFactor = 2,
    retryCondition = (error) => {
      // Retry on rate limits and temporary server errors
      if (error?.status === 429) return true; // Too Many Requests
      if (error?.status >= 500 && error?.status < 600) return true; // Server errors
      if (error?.clerkError && error?.status === 429) return true; // Clerk rate limits
      return false;
    }
  } = options;

  let lastError: any;
  let delay = baseDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        // Last attempt failed, throw the error
        break;
      }

      // Check if we should retry this error
      if (!retryCondition(error)) {
        throw error;
      }

      // Special handling for Clerk rate limits
      if (error?.status === 429 && error?.retryAfter) {
        // Use Clerk's suggested retry delay
        delay = (error.retryAfter * 1000) + Math.random() * 1000; // Add jitter
        console.log(`🕐 Rate limited by Clerk, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.log(`🔄 Retrying operation in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter and max delay cap
      delay = Math.min(delay * backoffFactor + Math.random() * 1000, maxDelayMs);
    }
  }

  // All retries exhausted
  console.error(`❌ Operation failed after ${maxRetries + 1} attempts:`, lastError);
  throw new RetryableError(`Operation failed after ${maxRetries + 1} attempts`, lastError);
}

// Convenience wrapper for Clerk API calls
export async function withClerkRetry<T>(operation: () => Promise<T>): Promise<T> {
  return withRetry(operation, {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 15000,
    backoffFactor: 2,
    retryCondition: (error) => {
      // Specifically for Clerk errors
      if (error?.clerkError && error?.status === 429) return true;
      if (error?.status === 429) return true;
      if (error?.status >= 500 && error?.status < 600) return true;
      return false;
    }
  });
}
