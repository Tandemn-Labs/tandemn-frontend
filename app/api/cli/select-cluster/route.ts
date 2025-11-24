import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey } from '@/lib/credits';
import { getUserAccount } from '@/lib/user-account-service';
import { isValidCluster } from '@/config/clusters';
import { createCliSessionToken } from '@/lib/cli-session';

/**
 * POST /api/cli/select-cluster
 * 
 * Allows CLI users to select clusters and receive a session token
 * 
 * Request body (new format):
 * {
 *   "apiKey": "gk-...",
 *   "clusters": ["Tandemn", "HAL"]
 * }
 * 
 * Request body (backward compatible):
 * {
 *   "apiKey": "gk-...",
 *   "cluster": "HAL"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "session_token": "eyJ...",
 *   "clusters": ["Tandemn", "HAL"],
 *   "expires_at": "2024-12-18T10:30:00.000Z"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, cluster, clusters } = body;
    
    // Support both old (cluster) and new (clusters) formats
    let selectedClusters: string[];
    if (clusters && Array.isArray(clusters)) {
      selectedClusters = clusters;
    } else if (cluster && typeof cluster === 'string') {
      selectedClusters = [cluster];
    } else {
      selectedClusters = [];
    }

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

    if (selectedClusters.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Cluster is required',
          message: 'Please specify at least one cluster to connect to'
        },
        { status: 400 }
      );
    }

    // Validate all clusters exist
    const invalidClusters = selectedClusters.filter(c => !isValidCluster(c));
    if (invalidClusters.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid cluster',
          message: `The following clusters do not exist: ${invalidClusters.join(', ')}`
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

    // Check if user has access to all requested clusters
    const userClusterIds = userAccount.clusters || ['Tandemn'];
    const unauthorizedClusters = selectedClusters.filter(c => !userClusterIds.includes(c));
    if (unauthorizedClusters.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Access denied',
          message: `You do not have access to the following clusters: ${unauthorizedClusters.join(', ')}. Available clusters: ${userClusterIds.join(', ')}`
        },
        { status: 403 }
      );
    }

    // Create session token
    const { token, expiresAt } = await createCliSessionToken(
      userAccount._id.toString(),
      clerkUserId,
      apiKeyId,
      selectedClusters
    );

    // Return success response with snake_case for Python client compatibility
    return NextResponse.json({
      success: true,
      session_token: token,
      clusters: selectedClusters,
      expires_at: expiresAt.toISOString(),
      message: `Successfully connected to clusters: ${selectedClusters.join(', ')}`,
    });

  } catch (error) {
    console.error('Error in CLI select-cluster:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while selecting the cluster.'
      },
      { status: 500 }
    );
  }
}

