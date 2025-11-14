// Client-side cached API calls
import { cache, CacheKeys, CacheTTL } from './cache';

export async function getCachedUserCredits(userId: string): Promise<number> {
  const cacheKey = CacheKeys.userCredits(userId);
  const cached = cache.get<number>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  try {
    const response = await fetch('/api/credits');
    if (response.ok) {
      const data = await response.json();
      const balance = data.balance || 0;
      cache.set(cacheKey, balance, CacheTTL.USER_CREDITS);
      return balance;
    }
  } catch (error) {
    console.error('Failed to fetch user credits:', error);
  }
  
  return 0;
}

export async function getCachedDeployments(): Promise<any> {
  const cacheKey = CacheKeys.deploymentStatus();
  const cached = cache.get<any>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  try {
    const response = await fetch('/api/deployments');
    if (response.ok) {
      const data = await response.json();
      cache.set(cacheKey, data, CacheTTL.DEPLOYMENT_STATUS);
      return data;
    }
  } catch (error) {
    console.error('Failed to fetch deployments:', error);
  }
  
  return { deployments: [] };
}

export async function getCachedModels(params?: string): Promise<any[]> {
  const cacheKey = `${CacheKeys.modelsList()}:${params || 'default'}`;
  const cached = cache.get<any[]>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  try {
    const url = params ? `/api/models?${params}` : '/api/models?limit=50&sort=popularity';
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const models = data.items || [];
      cache.set(cacheKey, models, CacheTTL.MODELS_LIST);
      return models;
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
  }
  
  return [];
}

export async function getCachedApiKeys(userId: string): Promise<any[]> {
  const cacheKey = CacheKeys.userApiKeys(userId);
  const cached = cache.get<any[]>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  try {
    const response = await fetch('/api/keys');
    if (response.ok) {
      const data = await response.json();
      const apiKeys = data.apiKeys || [];
      cache.set(cacheKey, apiKeys, CacheTTL.USER_API_KEYS);
      return apiKeys;
    }
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
  }
  
  return [];
}

// Invalidate cache helpers
export function invalidateUserCreditsCache(userId: string) {
  cache.delete(CacheKeys.userCredits(userId));
}

export function invalidateApiKeysCache(userId: string) {
  cache.delete(CacheKeys.userApiKeys(userId));
}

export function invalidateDeploymentsCache() {
  cache.delete(CacheKeys.deploymentStatus());
}

export function invalidateUserRoomsCache(userId: string) {
  cache.delete(CacheKeys.userRooms(userId));
}

