import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * GET /api/cli/session
 * 
 * Validates a CLI session token and returns session information
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Response:
 * {
 *   "success": true,
 *   "session": {
 *     "userId": "clerk_user_id",
 *     "cluster": "HAL",
 *     "expiresAt": "2024-12-18T10:30:00.000Z"
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing authorization',
          message: 'Authorization header with Bearer token is required'
        },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate session token
    const session = await validateCliSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired session',
          message: 'The session token is invalid or has expired'
        },
        { status: 401 }
      );
    }

    // Return session information
    return NextResponse.json({
      success: true,
      session: {
        userId: session.clerkUserId,
        cluster: session.cluster,
        expiresAt: new Date(session.exp * 1000).toISOString(),
        apiKeyId: session.apiKeyId,
      },
    });

  } catch (error) {
    console.error('Error validating CLI session:', error);
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

/**
 * DELETE /api/cli/session
 * 
 * Invalidates a CLI session (logout)
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Session invalidated"
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    // Extract session token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing authorization',
          message: 'Authorization header with Bearer token is required'
        },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Invalidate the session
    const { invalidateCliSession } = await import('@/lib/cli-session');
    const invalidated = await invalidateCliSession(sessionToken);

    if (!invalidated) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Session not found',
          message: 'The session token was not found or already invalidated'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session invalidated successfully',
    });

  } catch (error) {
    console.error('Error invalidating CLI session:', error);
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

