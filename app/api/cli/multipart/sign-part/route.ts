import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * POST /api/cli/multipart/sign-part
 * 
 * Signs an individual part for multipart upload
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Request body:
 * {
 *   "upload_id": "multipart-upload-id",
 *   "remote_path": "/path/to/large-file.bin",
 *   "part_number": 1,
 *   "expires": 600  // optional, defaults to 600 seconds
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "url": "presigned-url-for-part",
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
    const { upload_id, remote_path, part_number, expires = 600 } = body;

    // Validate required parameters
    if (!upload_id || typeof upload_id !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing upload_id',
          message: 'The upload_id parameter is required'
        },
        { status: 400 }
      );
    }

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

    if (!part_number || typeof part_number !== 'number' || part_number < 1 || !Number.isInteger(part_number)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid part_number',
          message: 'The part_number parameter must be a positive integer'
        },
        { status: 400 }
      );
    }

    // Validate expires parameter
    if (typeof expires !== 'number' || expires <= 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid expires',
          message: 'The expires parameter must be a positive number'
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
    formData.append('upload_id', upload_id);
    formData.append('user', session.clerkUserId);
    formData.append('remote_path', remote_path);
    formData.append('part_number', part_number.toString());
    formData.append('expires', expires.toString());

    // Make request to storage server
    console.log(`Signing part ${part_number} at: ${storageServerUrl}/storage/multipart/sign-part`);
    
    let storageResponse;
    try {
      storageResponse = await fetch(`${storageServerUrl}/storage/multipart/sign-part`, {
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
          message: `Failed to sign part: ${storageResponse.statusText}`,
          details: errorText
        },
        { status: 502 }
      );
    }

    // Parse storage server response
    const storageData = await storageResponse.json();

    // Return presigned URL data to CLI client
    return NextResponse.json({
      success: true,
      ...storageData,
    });

  } catch (error) {
    console.error('Error in CLI multipart sign-part endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while signing the upload part.'
      },
      { status: 500 }
    );
  }
}

