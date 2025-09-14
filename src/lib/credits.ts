import { createClerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { cache, CacheKeys, CacheTTL } from './cache';
import { withClerkRetry } from './retry';
import { withRateLimit, Priority } from './rate-limiter';

// Import shared types and constants
import { CREDIT_PACKAGES, type Transaction, type APIKey } from './credits-client';
export { CREDIT_PACKAGES } from './credits-client';
export type { Transaction, APIKey } from './credits-client';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Get user's current credit balance from Clerk metadata (with caching)
export async function getUserCredits(userId?: string): Promise<number> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return 0;

    // Load testing bypass - provide unlimited credits for testing
    if (process.env.NODE_ENV === 'development' && userIdToUse === 'test-user-loadtest') {
      return 10000; // Plenty of credits for load testing
    }

    // Check cache first
    const cacheKey = CacheKeys.userCredits(userIdToUse);
    const cachedCredits = cache.get<number>(cacheKey);
    if (cachedCredits !== null) {
      console.log('✅ Retrieved user credits from cache');
      return cachedCredits;
    }

    // Cache miss - fetch from Clerk with retry and rate limiting
    console.log('🔄 Cache miss - fetching user credits from Clerk');
    const user = await withRateLimit(
      () => withClerkRetry(async () => {
        return await clerkClient.users.getUser(userIdToUse);
      }),
      Priority.CRITICAL
    );
    
    const credits = (user.privateMetadata?.credits as number) || 20.00; // $20 default balance for everyone
    
    // Cache the result
    cache.set(cacheKey, credits, CacheTTL.USER_CREDITS);
    console.log(`✅ Cached user credits: $${credits.toFixed(4)}`);
    
    return credits;
  } catch (error) {
    console.error('Error getting user credits:', error);
    return 20.00; // $20 default balance even on error
  }
}

// Add credits to user's account
export async function addCredits(userId: string, amount: number): Promise<boolean> {
  try {
    const currentCredits = await getUserCredits(userId);
    const newCredits = currentCredits + amount;

    // Get current user data to preserve existing metadata
    const user = await clerkClient.users.getUser(userId);
    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata, // Preserve existing metadata like apiKeys
        credits: newCredits,
        lastCreditUpdate: new Date().toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding credits:', error);
    return false;
  }
}

// Deduct credits from user's account (with cache invalidation)
export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  try {
    const currentCredits = await getUserCredits(userId);
    
    if (currentCredits < amount) {
      return false; // Insufficient credits
    }

    const newCredits = currentCredits - amount;

    // Update Clerk with retry and rate limiting
    const success = await withRateLimit(
      () => withClerkRetry(async () => {
        // Get current user data to preserve existing metadata
        const user = await clerkClient.users.getUser(userId);
        await clerkClient.users.updateUser(userId, {
          privateMetadata: {
            ...user.privateMetadata, // Preserve existing metadata like apiKeys
            credits: newCredits,
            lastCreditUpdate: new Date().toISOString(),
          },
        });
        return true;
      }),
      Priority.HIGH
    );

    if (success) {
      // Invalidate cache after successful update
      const cacheKey = CacheKeys.userCredits(userId);
      cache.delete(cacheKey);
      console.log(`✅ Deducted $${amount.toFixed(4)}, new balance: $${newCredits.toFixed(4)}`);
    }

    return success;
  } catch (error) {
    console.error('Error deducting credits:', error);
    return false;
  }
}

// Get user's transaction history from metadata (with caching and rate limiting)
export async function getTransactionHistory(userId?: string): Promise<Transaction[]> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return [];

    // Check cache first
    const cacheKey = CacheKeys.userTransactions(userIdToUse);
    const cachedTransactions = cache.get<Transaction[]>(cacheKey);
    if (cachedTransactions !== null) {
      console.log('✅ Retrieved transaction history from cache');
      return cachedTransactions;
    }

    // Cache miss - fetch from Clerk with retry and rate limiting
    console.log('🔄 Cache miss - fetching transaction history from Clerk');
    const user = await withRateLimit(
      () => withClerkRetry(async () => {
        return await clerkClient.users.getUser(userIdToUse);
      }),
      Priority.NORMAL
    );
    
    const transactions = (user.privateMetadata?.transactions as Transaction[]) || [];
    
    // Cache the result
    cache.set(cacheKey, transactions, CacheTTL.USER_TRANSACTIONS);
    console.log(`✅ Cached transaction history: ${transactions.length} transactions`);
    
    return transactions;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}

// Add transaction to user's history
export async function addTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<void> {
  try {
    const currentTransactions = await getTransactionHistory(userId);
    const newTransaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: new Date().toISOString(),
      ...transaction,
    };

    // Keep only last 20 transactions to avoid metadata size limits (reduced from 50)
    const updatedTransactions = [newTransaction, ...currentTransactions].slice(0, 20);

    const user = await clerkClient.users.getUser(userId);
    
    // Check metadata size before updating
    const currentMetadataSize = JSON.stringify(user.privateMetadata).length;
    console.log('Current metadata size before transaction:', currentMetadataSize, 'bytes');
    
    // If metadata is getting large, prioritize API keys over transaction history
    const preserveApiKeys = user.privateMetadata?.apiKeys || [];
    
    // Prepare clean metadata - prioritize essential data
    const cleanMetadata = {
      credits: user.privateMetadata?.credits || 20.00, // $20 default balance
      lastCreditUpdate: user.privateMetadata?.lastCreditUpdate,
      apiKeys: preserveApiKeys, // Always preserve API keys
      transactions: currentMetadataSize > 6000 ? updatedTransactions.slice(0, 10) : updatedTransactions, // Reduce further if metadata is large
    };
    
    const newMetadataSize = JSON.stringify(cleanMetadata).length;
    console.log('New metadata size with transaction:', newMetadataSize, 'bytes');
    
    // Only update if metadata size is reasonable (under 7KB to be safe)
    if (newMetadataSize > 7000) {
      console.warn('⚠️ Metadata would be too large, skipping transaction history update');
      return;
    }

    await clerkClient.users.updateUser(userId, {
      privateMetadata: cleanMetadata,
    });

    // Invalidate transaction cache after successful update
    const transactionCacheKey = CacheKeys.userTransactions(userId);
    cache.delete(transactionCacheKey);
    console.log('✅ Transaction added and cache invalidated for user:', userId);
  } catch (error) {
    console.error('Error adding transaction:', error);
    
    // Try to add without metadata update as fallback
    if (error instanceof Error && error.message.includes('Unprocessable Entity')) {
      console.warn('⚠️ Clerk metadata too large, skipping transaction history update');
    }
  }
}

// Simulate credit purchase (in real app, this would integrate with Stripe through Clerk)
export async function purchaseCredits(packageId: string, userId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) {
      return { success: false, message: 'User not authenticated' };
    }

    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
    if (!creditPackage) {
      return { success: false, message: 'Invalid credit package' };
    }

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In a real implementation, you would:
    // 1. Create a Clerk billing session or use webhooks
    // 2. Handle the payment through Clerk's Stripe integration
    // 3. Add credits upon successful payment

    const creditsToAdd = creditPackage.credits;
    const success = await addCredits(userIdToUse, creditsToAdd);

    if (success) {
      await addTransaction(userIdToUse, {
        type: 'credit_purchase',
        amount: creditsToAdd,
        description: `Purchased ${creditPackage.name}`,
        status: 'completed',
        packageId,
      });

      return { 
        success: true, 
        message: `Successfully purchased ${creditsToAdd} credits!` 
      };
    }

    return { success: false, message: 'Failed to add credits' };
  } catch (error) {
    console.error('Error purchasing credits:', error);
    return { success: false, message: 'Purchase failed' };
  }
}

// Use the unified calculateCost function from models.ts
import { calculateCost } from '@/config/models';
export { calculateCost as calculateTokenCost } from '@/config/models';

// Charge credits for API usage based on token consumption
export async function chargeForUsage(modelId: string, inputTokens: number, outputTokens: number, userId?: string): Promise<boolean> {
  const cost = calculateCost(modelId, inputTokens, outputTokens);
  const description = `${modelId}: ${inputTokens} input + ${outputTokens} output tokens`;
  
  return await chargeCredits(cost, description, userId, { 
    modelId, 
    inputTokens, 
    outputTokens, 
    costPerInputToken: inputTokens > 0 ? (cost * (inputTokens / (inputTokens + outputTokens)) / inputTokens * 1000000) : 0,
    costPerOutputToken: outputTokens > 0 ? (cost * (outputTokens / (inputTokens + outputTokens)) / outputTokens * 1000000) : 0
  });
}

// Charge credits for API calls (1 credit standard, 2 for batch)
export async function chargeCredits(amount: number, description: string, userId?: string, metadata?: any): Promise<boolean> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return false;

    // Load testing bypass - always succeed for test user
    if (process.env.NODE_ENV === 'development' && userIdToUse === 'test-user-loadtest') {
      return true; // Always successful charge for load testing
    }

    const success = await deductCredits(userIdToUse, amount);
    
    if (success) {
      await addTransaction(userIdToUse, {
        type: 'usage_charge',
        amount: -amount,
        description,
        status: 'completed',
        metadata,
      });
    }

    return success;
  } catch (error) {
    console.error('Error charging credits:', error);
    return false;
  }
}

// Give new users starting credits
export async function giveWelcomeCredits(userId: string): Promise<void> {
  try {
    const currentCredits = await getUserCredits(userId);
    
    // Only give welcome credits if user has no credits
    if (currentCredits === 0) {
      const welcomeCredits = 20.00; // $20 welcome credits
      await addCredits(userId, welcomeCredits);
      
      await addTransaction(userId, {
        type: 'bonus_credit',
        amount: welcomeCredits,
        description: 'Welcome bonus credits',
        status: 'completed',
      });
    }
  } catch (error) {
    console.error('Error giving welcome credits:', error);
  }
}

// API Key Management

// Generate API key for user
export async function generateAPIKey(name: string, userId?: string): Promise<{ success: boolean; apiKey?: APIKey; message: string }> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) {
      return { success: false, message: 'User not authenticated' };
    }

    // Generate a secure API key
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const apiKeyValue = `gk-${userIdToUse.slice(-8)}_${Math.random().toString(36).substring(2, 34)}`;

    const newAPIKey: APIKey = {
      id: keyId,
      name,
      key: apiKeyValue,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    // Get current API keys
    const currentKeys = await getUserAPIKeys(userIdToUse);
    
    // Limit to 5 API keys per user
    if (currentKeys.length >= 5) {
      return { success: false, message: 'Maximum 5 API keys allowed per user' };
    }

    const updatedKeys = [...currentKeys, newAPIKey];

    // Update user metadata with new API key
    const user = await clerkClient.users.getUser(userIdToUse);
    
    // Log current metadata size for debugging
    console.log('Current metadata size:', JSON.stringify(user.privateMetadata).length, 'bytes');
    console.log('API keys count:', currentKeys.length);
    
    // Clean up metadata to avoid size limits (Clerk has ~8KB limit)
    const cleanMetadata = {
      credits: user.privateMetadata?.credits || 20.00, // $20 default balance
      lastCreditUpdate: user.privateMetadata?.lastCreditUpdate,
      apiKeys: updatedKeys,
      // Remove large transaction history to make room for API keys
      transactions: undefined, // This will save significant space
    };
    
    // Log new metadata size
    console.log('New metadata size:', JSON.stringify(cleanMetadata).length, 'bytes');

    await clerkClient.users.updateUser(userIdToUse, {
      privateMetadata: cleanMetadata,
    });

    return { success: true, apiKey: newAPIKey, message: 'API key generated successfully' };
  } catch (error) {
    console.error('Error generating API key:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      // Check for Clerk-specific errors
      if ('clerkError' in error && error.clerkError) {
        console.error('Clerk error details:', {
          status: (error as any).status,
          clerkTraceId: (error as any).clerkTraceId,
          errors: (error as any).errors,
        });
      }
    }
    
    return { success: false, message: 'Failed to generate API key' };
  }
}

// Get user's API keys
export async function getUserAPIKeys(userId?: string): Promise<APIKey[]> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return [];

    const user = await clerkClient.users.getUser(userIdToUse);
    return (user.privateMetadata?.apiKeys as APIKey[]) || [];
  } catch (error) {
    console.error('Error getting user API keys:', error);
    return [];
  }
}

// Validate API key and get user ID (with caching)
export async function validateAPIKey(apiKey: string): Promise<{ valid: boolean; userId?: string; keyInfo?: APIKey }> {
  try {
    // Extract user ID hint from API key format: gk-{userIdHint}_{random}
    if (!apiKey.startsWith('gk-')) return { valid: false };
    
    // Load testing bypass
    if (process.env.NODE_ENV === 'development' && apiKey === 'gk-loadtest_12345678901234567890') {
      return {
        valid: true,
        userId: 'test-user-loadtest',
        keyInfo: {
          id: 'test-key-id',
          key: apiKey,
          name: 'Load Test Key',
          isActive: true,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
      };
    }

    // Check cache first
    const cacheKey = CacheKeys.apiKeyValidation(apiKey);
    const cachedValidation = cache.get<{ valid: boolean; userId?: string; keyInfo?: APIKey }>(cacheKey);
    if (cachedValidation !== null) {
      console.log('✅ Retrieved API key validation from cache');
      
      // Still update last used in background if valid (non-blocking)
      if (cachedValidation.valid && cachedValidation.userId && cachedValidation.keyInfo) {
        updateAPIKeyLastUsedBackground(cachedValidation.userId, cachedValidation.keyInfo.id);
      }
      
      return cachedValidation;
    }
    
    const parts = apiKey.substring(3).split('_'); // Remove 'gk-' prefix and split
    const userIdHint = parts[0];
    if (!userIdHint || userIdHint.length !== 8) return { valid: false };

    // Cache miss - search for users with this API key (with retry and rate limiting)
    console.log('🔄 Cache miss - validating API key with Clerk');
    const validation = await withRateLimit(
      () => withClerkRetry(async () => {
        const users = await clerkClient.users.getUserList({ limit: 100 });
        
        for (const user of users.data) {
          if (user.id.slice(-8) === userIdHint) {
            const apiKeys = (user.privateMetadata?.apiKeys as APIKey[]) || [];
            const keyInfo = apiKeys.find(key => key.key === apiKey && key.isActive);
            
            if (keyInfo) {
              return { valid: true, userId: user.id, keyInfo };
            }
          }
        }
        return { valid: false };
      }),
      Priority.CRITICAL
    );

    // Cache the result (valid or invalid)
    cache.set(cacheKey, validation, CacheTTL.API_KEY_VALIDATION);
    console.log(`✅ Cached API key validation: ${validation.valid ? 'valid' : 'invalid'}`);

    // Update last used timestamp in the background (non-blocking)
    if (validation.valid && validation.userId && validation.keyInfo) {
      updateAPIKeyLastUsedBackground(validation.userId, validation.keyInfo.id);
    }

    return validation;
  } catch (error) {
    console.error('Error validating API key:', error);
    return { valid: false };
  }
}

// Update API key last used timestamp (background operation with retry)
async function updateAPIKeyLastUsed(userId: string, keyId: string, currentMetadata: any): Promise<void> {
  try {
    const apiKeys = (currentMetadata?.apiKeys as APIKey[]) || [];
    const updatedKeys = apiKeys.map(key => 
      key.id === keyId 
        ? { ...key, lastUsed: new Date().toISOString() }
        : key
    );
    
    await withClerkRetry(async () => {
      await clerkClient.users.updateUser(userId, {
        privateMetadata: {
          ...currentMetadata,
          apiKeys: updatedKeys,
        },
      });
    });
  } catch (error) {
    console.error('Error updating API key last used timestamp:', error);
    // Don't throw - this is a background operation
  }
}

// Background wrapper that doesn't block the main request
function updateAPIKeyLastUsedBackground(userId: string, keyId: string): void {
  // Run in background with low priority
  withRateLimit(
    () => withClerkRetry(async () => {
      const user = await clerkClient.users.getUser(userId);
      return updateAPIKeyLastUsed(userId, keyId, user.privateMetadata);
    }),
    Priority.LOW
  ).catch(error => {
    console.error('Background API key update failed:', error);
    // Silently fail - this is non-critical
  });
}

// Delete API key
export async function deleteAPIKey(keyId: string, userId?: string): Promise<boolean> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return false;

    const currentKeys = await getUserAPIKeys(userIdToUse);
    const updatedKeys = currentKeys.filter(key => key.id !== keyId);

    const user = await clerkClient.users.getUser(userIdToUse);
    await clerkClient.users.updateUser(userIdToUse, {
      privateMetadata: {
        ...user.privateMetadata,
        apiKeys: updatedKeys,
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting API key:', error);
    return false;
  }
}