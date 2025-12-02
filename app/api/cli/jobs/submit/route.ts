import { NextRequest, NextResponse } from 'next/server';
import { validateCliSession } from '@/lib/cli-session';

/**
 * POST /api/cli/jobs/submit
 * 
 * CLI job submission endpoint - validates session and submits job to central orchestrator server
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Request body:
 * {
 *   "task_mode": "batched_inference",
 *   "model_name": "llama-70b-hf",
 *   "backend": "vllm",
 *   "quantization": "awq",
 *   "dataset_path": "s3://...",
 *   "column_names": ["prompt", "response"],
 *   "slo": "2h",
 *   "generation_kwargs": {...}
 * }
 * 
 * Response:
 * {
 *   "status": "success",
 *   "job_id": "uuid-here",
 *   "message": "Job {job_id} submitted successfully",
 *   "application_queue_key": "tandemn:app_jobs:llama-70b-hf:batched_inference:vllm:awq"
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

    // Generate unique job_id
    const jobId = crypto.randomUUID();

    // Add user from session
    const user = session.clerkUserId;

    // Add submit_time
    const submitTime = new Date().toISOString();

    // Merge all job data
    const jobData = {
      job_id: jobId,
      user: user,
      submit_time: submitTime,
      ...body, // Include all parameters from the request body
    };

    // Check for central server URL
    const centralServerUrl = process.env.CENTRAL_SERVER_URL;
    if (!centralServerUrl) {
      console.error('CENTRAL_SERVER_URL environment variable is not set');
      return NextResponse.json(
        { 
          success: false,
          error: 'Central server not configured',
          message: 'The central orchestrator server is not properly configured'
        },
        { status: 503 }
      );
    }

    // Build the central server URL
    const submitUrl = `${centralServerUrl}/jobs/submit`;

    // Make request to central server
    console.log(`Submitting job to central server at: ${submitUrl}`);
    console.log(`Job data:`, JSON.stringify(jobData, null, 2));
    
    let centralResponse;
    try {
      centralResponse = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });
    } catch (fetchError) {
      console.error('Failed to connect to central server:', fetchError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Central server connection failed',
          message: `Cannot connect to central server at ${centralServerUrl}. Make sure CENTRAL_SERVER_URL is correct and the server is running.`,
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 503 }
      );
    }

    // Handle non-OK responses from central server
    if (!centralResponse.ok) {
      const errorText = await centralResponse.text();
      console.error(`Central server returned ${centralResponse.status}:`, errorText);
      
      // Try to parse as JSON for better error messages
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText };
      }

      return NextResponse.json(
        { 
          success: false,
          error: 'Central server error',
          message: errorData.detail || errorData.message || `Central server returned ${centralResponse.status}`,
          details: errorData
        },
        { status: centralResponse.status }
      );
    }

    // Parse and return the central server response
    const data = await centralResponse.json();
    
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error submitting job:', error);
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


