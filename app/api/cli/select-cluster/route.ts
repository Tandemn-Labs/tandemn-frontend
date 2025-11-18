import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey } from '@/lib/credits';
import { getUserAccount } from '@/lib/user-account-service';
import { isValidCluster } from '@/config/clusters';
import { createCliSessionToken } from '@/lib/cli-session';

/**
 * POST /api/cli/select-cluster
 * 
 * Allows CLI users to select a cluster and receive a session token
 * 
 * Request body:
 * {
 *   "apiKey": "gk-...",
 *   "cluster": "HAL"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "sessionToken": "eyJ...",
 *   "cluster": "HAL",
 *   "expiresAt": "2024-12-18T10:30:00.000Z"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, cluster } = body;

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

    if (!cluster || typeof cluster !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Cluster is required',
          message: 'Please specify which cluster to connect to'
        },
        { status: 400 }
      );
    }

    // Validate cluster exists
    if (!isValidCluster(cluster)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid cluster',
          message: `Cluster '${cluster}' does not exist`
        },
        { status: 400 }
      );
    }

    // Validate API key
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId || !validation.keyId) {
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
    const apiKeyId = validation.keyId;

    // Get user account to check cluster access
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

    // Check if user has access to the requested cluster
    const userClusterIds = userAccount.clusters || ['Tandemn'];
    if (!userClusterIds.includes(cluster)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Access denied',
          message: `You do not have access to the '${cluster}' cluster. Available clusters: ${userClusterIds.join(', ')}`
        },
        { status: 403 }
      );
    }

    // Create session token
    const { token, expiresAt } = await createCliSessionToken(
      userAccount._id.toString(),
      clerkUserId,
      apiKeyId,
      cluster
    );

    // Return success response
    return NextResponse.json({
      success: true,
      sessionToken: token,
      cluster,
      expiresAt: expiresAt.toISOString(),
      message: `Successfully connected to ${cluster} cluster`,
    });

  } catch (error) {
    console.error('Error in CLI select-cluster:', error);
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

