// Simple in-memory cache for user data to reduce Clerk API calls
// In production, you'd use Redis or similar external cache

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default TTL

  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats for debugging
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired
    };
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Auto-cleanup every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

// Cache key generators
export const CacheKeys = {
  userCredits: (userId: string) => `user:${userId}:credits`,
  apiKeyValidation: (apiKey: string) => `apikey:${apiKey}:validation`,
  userApiKeys: (userId: string) => `user:${userId}:apikeys`,
  userMetadata: (userId: string) => `user:${userId}:metadata`,
  userTransactions: (userId: string) => `user:${userId}:transactions`,
};

// Cache TTLs (Time To Live) in milliseconds
export const CacheTTL = {
  USER_CREDITS: 2 * 60 * 1000,    // 2 minutes - balance changes frequently
  API_KEY_VALIDATION: 10 * 60 * 1000, // 10 minutes - API keys don't change often
  USER_API_KEYS: 5 * 60 * 1000,   // 5 minutes - API keys don't change often
  USER_METADATA: 3 * 60 * 1000,   // 3 minutes - metadata can change
  USER_TRANSACTIONS: 1 * 60 * 1000, // 1 minute - transactions change frequently
};
