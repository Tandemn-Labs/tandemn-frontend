import { NextRequest, NextResponse } from 'next/server';

const BATCH_INFERENCE_BASE_URL = 'http://98.80.0.197:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    console.log('Checking task status for:', taskId);

    // Forward the request to the batch inference server
    const response = await fetch(`${BATCH_INFERENCE_BASE_URL}/batch_task_status/${taskId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Task status check error:', {
        taskId,
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to check task status',
          details: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Task status retrieved:', { taskId, status: result.status, fullResponse: result });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error checking task status:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Cannot connect to batch inference server',
          details: 'The batch inference server at 98.80.0.197:8000 is not responding. Please check if the server is running.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

