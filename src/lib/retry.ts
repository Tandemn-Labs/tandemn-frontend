// Retry mechanism with exponential backoff for Clerk API calls

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

// Define error interfaces for better type safety
interface ErrorWithStatus {
  status?: number;
  message?: string;
}

interface ErrorWithRetryAfter extends ErrorWithStatus {
  retryAfter?: number;
}

interface ClerkError extends ErrorWithStatus {
  clerkError?: boolean;
}

// Type guard functions
function hasStatus(error: any): error is Required<ErrorWithStatus> {
  return error && typeof error === 'object' && typeof error.status === 'number';
}

function hasRetryAfter(error: any): error is Required<ErrorWithRetryAfter> {
  return error && typeof error === 'object' && typeof error.status === 'number' && typeof error.retryAfter === 'number';
}

function isClerkError(error: any): error is ClerkError {
  return error && typeof error === 'object' && error.clerkError === true;
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
      if (hasStatus(error) && error.status === 429) return true; // Too Many Requests
      if (hasStatus(error) && error.status >= 500 && error.status < 600) return true; // Server errors
      if (isClerkError(error) && hasStatus(error) && error.status === 429) return true; // Clerk rate limits
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
      if (hasStatus(error) && error.status === 429 && hasRetryAfter(error)) {
        // Use Clerk's suggested retry delay
        delay = (error.retryAfter * 1000) + Math.random() * 1000; // Add jitter
        console.log(`🕐 Rate limited by Clerk, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`🔄 Retrying operation in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, errorMessage);
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
      if (isClerkError(error) && hasStatus(error) && error.status === 429) return true;
      if (hasStatus(error) && error.status === 429) return true;
      if (hasStatus(error) && error.status >= 500 && error.status < 600) return true;
      return false;
    }
  });
}
