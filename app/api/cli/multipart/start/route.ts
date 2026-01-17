import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * POST /api/cli/multipart/start
 * 
 * Initiates a multipart upload session for large files
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Request body:
 * {
 *   "remote_path": "/path/to/large-file.bin"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "upload_id": "multipart-upload-id",
 *   ...additionalFields
 * }
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { remote_path } = body;

    // Validate required parameters
    if (!remote_path || typeof remote_path !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing remote_path',
          message: 'The remote_path parameter is required'
        },
        { status: 400 }
      );
    }

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
        { status: 500 }
      );
    }

    // Prepare FormData for storage server request
    const formData = new FormData();
    formData.append('remote_path', remote_path);
    formData.append('user', session.clerkUserId);

    // Make request to storage server
    console.log(`Starting multipart upload at: ${storageServerUrl}/storage/multipart/start`);
    
    let storageResponse;
    try {
      storageResponse = await fetch(`${storageServerUrl}/storage/multipart/start`, {
        method: 'POST',
        body: formData,
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
      console.error('Storage server error:', storageResponse.status, errorText);
      return NextResponse.json(
        { 
          success: false,
          error: 'Storage server error',
          message: `Failed to start multipart upload: ${storageResponse.statusText}`,
          details: errorText
        },
        { status: 502 }
      );
    }

    // Parse storage server response
    const storageData = await storageResponse.json();

    // Return multipart upload data to CLI client
    return NextResponse.json({
      success: true,
      ...storageData,
    });

  } catch (error) {
    console.error('Error in CLI multipart start endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while starting the multipart upload.'
      },
      { status: 500 }
    );
  }
}

