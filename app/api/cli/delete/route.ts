import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * DELETE /api/cli/delete
 * 
 * CLI file delete endpoint - validates session and deletes file from storage server
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Query parameters:
 * remote_path: Required path to the file (e.g., "file.txt" or "/folder/file.txt")
 * file_path: Backward-compatible alias for remote_path
 * 
 * Response:
 * {
 *   "success": true,
 *   ...additionalFields
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

    // Extract required file path parameter from query string
    const { searchParams } = new URL(request.url);
    const remotePath = searchParams.get('remote_path') || searchParams.get('file_path');

    if (!remotePath) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing remote_path',
          message: 'The remote_path query parameter is required'
        },
        { status: 400 }
      );
    }

    // Normalize remote path to a relative path the storage server expects
    const normalizedRemotePath = remotePath.startsWith('s3://')
      ? remotePath.split('/').pop() || ''
      : remotePath;

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

    // Build the storage server URL with user and file path
    const userId = session.clerkUserId;
    const normalizedFilePath = normalizedRemotePath.startsWith('/')
      ? normalizedRemotePath.substring(1)
      : normalizedRemotePath;
    const storageDeleteUrl = `${storageServerUrl}/storage/delete/${userId}/${normalizedFilePath}`;

    // Make request to storage server
    console.log(`Deleting file from storage server at: ${storageDeleteUrl}`);
    
    let storageResponse;
    try {
      storageResponse = await fetch(storageDeleteUrl, {
        method: 'DELETE',
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
      if (storageResponse.status === 404) {
        return NextResponse.json(
          { 
            success: false,
            error: 'File not found',
            message: `The file "${remotePath}" was not found in storage`
          },
          { status: 404 }
        );
      }

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

    const data = await storageResponse.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error deleting file:', error);
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

