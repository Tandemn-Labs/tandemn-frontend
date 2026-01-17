import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * GET /api/cli/list
 * 
 * CLI file listing endpoint - validates session and returns list of files from storage server
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Query parameters:
 * prefix: Optional prefix filter for subdirectories (e.g., "/folder/subfolder")
 * 
 * Response:
 * {
 *   "status": "success",
 *   "user": "user_id",
 *   "prefix": "",
 *   "files": [...],
 *   "count": 5
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

    // Extract optional prefix parameter from query string
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';

    // Check for storage server URL
    const storageServerUrl = process.env.STORAGE_SERVER_URL;
    if (!storageServerUrl) {
      console.error('STORAGE_SERVER_URL environment variable is not set');
      return NextResponse.json(
        { 
          success: false,
          error: 'Storage server not configured',
          message: 'The storage server is not properly configured'
        },
        { status: 503 }
      );
    }

    // Build the storage server URL with user and optional prefix
    const userId = session.clerkUserId;
    const storageListUrl = new URL(`${storageServerUrl}/storage/list/${userId}`);
    if (prefix) {
      storageListUrl.searchParams.set('prefix', prefix);
    }

    // Make request to storage server
    console.log(`Fetching file list from storage server at: ${storageListUrl.toString()}`);
    
    let storageResponse;
    try {
      storageResponse = await fetch(storageListUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('Failed to connect to storage server:', fetchError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Storage server connection failed',
          message: `Cannot connect to storage server at ${storageServerUrl}. Make sure STORAGE_SERVER_URL is correct and the server is running.`,
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 503 }
      );
    }

    if (!storageResponse.ok) {
      const errorText = await storageResponse.text();
      console.error(`Storage server returned ${storageResponse.status}:`, errorText);
      return NextResponse.json(
        { 
          success: false,
          error: 'Storage server error',
          message: `Storage server returned ${storageResponse.status}`,
          details: errorText
        },
        { status: storageResponse.status }
      );
    }

    // Parse and return the storage server response
    const data = await storageResponse.json();
    
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error listing files:', error);
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

