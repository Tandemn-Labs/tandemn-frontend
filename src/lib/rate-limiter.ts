// Request queuing and rate limiting to prevent overwhelming Clerk API

interface QueueItem {
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
}

class RateLimiter {
  private queue: QueueItem[] = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly MAX_REQUESTS_PER_WINDOW = 80; // Conservative limit for Clerk
  private readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private readonly DELAY_BETWEEN_REQUESTS = 100; // 100ms between requests

  async execute<T>(operation: () => Promise<T>, priority: number = 1): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ operation, resolve, reject, priority });
      this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Reset window if needed
      const now = Date.now();
      if (now - this.windowStart > this.WINDOW_MS) {
        this.requestCount = 0;
        this.windowStart = now;
      }
      
      // Check if we're at the rate limit
      if (this.requestCount >= this.MAX_REQUESTS_PER_WINDOW) {
        const waitTime = this.WINDOW_MS - (now - this.windowStart);
        console.log(`🕐 Rate limit reached, waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.windowStart = Date.now();
      }
      
      const item = this.queue.shift()!;
      
      try {
        const result = await item.operation();
        this.requestCount++;
        item.resolve(result);
        
        // Small delay between requests to be gentle on Clerk
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_REQUESTS));
        }
      } catch (error) {
        this.requestCount++;
        item.reject(error);
      }
    }
    
    this.processing = false;
  }

  getQueueStats() {
    return {
      queueLength: this.queue.length,
      requestsInWindow: this.requestCount,
      windowTimeRemaining: Math.max(0, this.WINDOW_MS - (Date.now() - this.windowStart))
    };
  }
}

// Global rate limiter instance
export const clerkRateLimiter = new RateLimiter();

// Wrapper function for Clerk operations
export async function withRateLimit<T>(
  operation: () => Promise<T>, 
  priority: number = 1
): Promise<T> {
  return clerkRateLimiter.execute(operation, priority);
}

// Priority levels for different operations
export const Priority = {
  CRITICAL: 10,     // API key validation, user credits check
  HIGH: 5,          // Credit deduction, user updates
  NORMAL: 1,        // Background updates, metrics
  LOW: 0           // Non-critical updates
} as const;
