import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * GET /api/cli/download
 * 
 * CLI file download endpoint - validates session and streams file from storage server
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Query parameters:
 * file_path: Required path to the file (e.g., "/folder/file.txt")
 * 
 * Response:
 * Streams the file content with appropriate headers for download
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

    // Extract required file_path parameter from query string
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file_path');

    if (!filePath) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing file_path',
          message: 'The file_path query parameter is required'
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
        { status: 503 }
      );
    }

    // Build the storage server URL with user and file path
    const userId = session.clerkUserId;
    // Remove leading slash from file path if present to avoid double slashes
    const normalizedFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const storageDownloadUrl = `${storageServerUrl}/storage/download/${userId}/${normalizedFilePath}`;

    // Make request to storage server
    console.log(`Downloading file from storage server at: ${storageDownloadUrl}`);
    
    let storageResponse;
    try {
      storageResponse = await fetch(storageDownloadUrl, {
        method: 'GET',
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

    // Handle non-OK responses from storage server
    if (!storageResponse.ok) {
      if (storageResponse.status === 404) {
        return NextResponse.json(
          { 
            success: false,
            error: 'File not found',
            message: `The file "${filePath}" was not found in storage`
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

    // Extract filename from the file path for Content-Disposition header
    const filename = filePath.split('/').pop() || 'download';

    // Create response headers
    const headers = new Headers();
    
    // Copy Content-Type from storage response or use default
    const contentType = storageResponse.headers.get('Content-Type') || 'application/octet-stream';
    headers.set('Content-Type', contentType);
    
    // Set Content-Disposition for download
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Copy Content-Length if available
    const contentLength = storageResponse.headers.get('Content-Length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Stream the response body directly to the client
    return new Response(storageResponse.body, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error downloading file:', error);
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

