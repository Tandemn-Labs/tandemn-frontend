import { createClerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';

// Import shared types and constants
import { CREDIT_PACKAGES, formatCurrency, formatCredits, type Transaction, type APIKey } from './credits-client';
export { CREDIT_PACKAGES, formatCurrency, formatCredits } from './credits-client';
export type { Transaction, APIKey } from './credits-client';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Get user's current credit balance from Clerk metadata
export async function getUserCredits(userId?: string): Promise<number> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return 0;

    const user = await clerkClient.users.getUser(userIdToUse);
    return (user.privateMetadata?.credits as number) || 0;
  } catch (error) {
    console.error('Error getting user credits:', error);
    return 0;
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

// Deduct credits from user's account
export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  try {
    const currentCredits = await getUserCredits(userId);
    
    if (currentCredits < amount) {
      return false; // Insufficient credits
    }

    const newCredits = currentCredits - amount;

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
    console.error('Error deducting credits:', error);
    return false;
  }
}

// Get user's transaction history from metadata
export async function getTransactionHistory(userId?: string): Promise<Transaction[]> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return [];

    const user = await clerkClient.users.getUser(userIdToUse);
    return (user.privateMetadata?.transactions as Transaction[]) || [];
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
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      ...transaction,
    };

    // Keep only last 100 transactions
    const updatedTransactions = [newTransaction, ...currentTransactions].slice(0, 100);

    const user = await clerkClient.users.getUser(userId);
    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        transactions: updatedTransactions,
      },
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
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

// Charge credits for API usage (simple 1 credit per call)
export async function chargeForUsage(modelId: string, inputTokens: number, outputTokens: number, userId?: string): Promise<boolean> {
  return await chargeCredits(1, `Used ${modelId}`, userId, { modelId, inputTokens, outputTokens });
}

// Charge credits for API calls (1 credit standard, 2 for batch)
export async function chargeCredits(amount: number, description: string, userId?: string, metadata?: any): Promise<boolean> {
  try {
    const userIdToUse = userId || (await auth()).userId;
    if (!userIdToUse) return false;

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
      const welcomeCredits = 5.00; // $5 welcome credits
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
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const apiKeyValue = `gk-${userIdToUse.slice(-8)}_${Math.random().toString(36).substr(2, 32)}`;

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
    await clerkClient.users.updateUser(userIdToUse, {
      privateMetadata: {
        ...user.privateMetadata,
        apiKeys: updatedKeys,
      },
    });

    return { success: true, apiKey: newAPIKey, message: 'API key generated successfully' };
  } catch (error) {
    console.error('Error generating API key:', error);
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

// Validate API key and get user ID
export async function validateAPIKey(apiKey: string): Promise<{ valid: boolean; userId?: string; keyInfo?: APIKey }> {
  try {
    // Extract user ID hint from API key format: gk-{userIdHint}_{random}
    if (!apiKey.startsWith('gk-')) return { valid: false };
    
    const parts = apiKey.substring(3).split('_'); // Remove 'gk-' prefix and split
    const userIdHint = parts[0];
    if (!userIdHint || userIdHint.length !== 8) return { valid: false };

    // Search for users with this API key (in production, you'd use a database index)
    const users = await clerkClient.users.getUserList({ limit: 100 });
    
    for (const user of users.data) {
      if (user.id.slice(-8) === userIdHint) {
        const apiKeys = (user.privateMetadata?.apiKeys as APIKey[]) || [];
        const keyInfo = apiKeys.find(key => key.key === apiKey && key.isActive);
        
        if (keyInfo) {
          // Update last used timestamp in the background (non-blocking)
          updateAPIKeyLastUsed(user.id, keyInfo.id, user.privateMetadata).catch(err => {
            console.error('Failed to update API key last used timestamp:', err);
          });

          return { valid: true, userId: user.id, keyInfo };
        }
      }
    }

    return { valid: false };
  } catch (error) {
    console.error('Error validating API key:', error);
    return { valid: false };
  }
}

// Update API key last used timestamp (background operation)
async function updateAPIKeyLastUsed(userId: string, keyId: string, currentMetadata: any): Promise<void> {
  try {
    const apiKeys = (currentMetadata?.apiKeys as APIKey[]) || [];
    const updatedKeys = apiKeys.map(key => 
      key.id === keyId 
        ? { ...key, lastUsed: new Date().toISOString() }
        : key
    );
    
    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...currentMetadata,
        apiKeys: updatedKeys,
      },
    });
  } catch (error) {
    console.error('Error updating API key last used timestamp:', error);
    // Don't throw - this is a background operation
  }
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