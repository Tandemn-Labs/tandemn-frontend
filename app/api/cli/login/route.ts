import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey } from '@/lib/credits';
import { getUserAccount } from '@/lib/user-account-service';
import { getUserClusters } from '@/config/clusters';

/**
 * POST /api/cli/login
 * 
 * CLI login endpoint - validates API key and returns user info with available clusters
 * 
 * Request body:
 * {
 *   "apiKey": "gk-..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "id": "clerk_user_id",
 *     "email": "user@example.com",
 *     "credits": 20.00
 *   },
 *   "clusters": [
 *     {
 *       "id": "Tandemn",
 *       "name": "Tandemn",
 *       "description": "Main Tandemn cluster - available to all users"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    // Validate input
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'API key is required',
          message: 'Please provide a valid API key'
        },
        { status: 400 }
      );
    }

    // Validate API key
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid API key',
          message: 'The provided API key is invalid or has been deactivated'
        },
        { status: 401 }
      );
    }

    const clerkUserId = validation.userId;

    // Get user account to fetch available clusters
    const userAccount = await getUserAccount(clerkUserId);
    if (!userAccount) {
      return NextResponse.json(
        { 
          success: false,
          error: 'User account not found',
          message: 'Unable to find user account'
        },
        { status: 404 }
      );
    }

    // Get user's available clusters (with default fallback)
    const userClusterIds = userAccount.clusters || ['Tandemn'];
    const availableClusters = getUserClusters(userClusterIds);

    // Return success response
    return NextResponse.json({
      success: true,
      user: {
        id: clerkUserId,
        email: userAccount.email,
        credits: userAccount.credits,
      },
      clusters: availableClusters.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
      apiKeyId: validation.keyId,
    });

  } catch (error) {
    console.error('Error in CLI login:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

