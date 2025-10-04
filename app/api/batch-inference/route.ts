import { NextRequest, NextResponse } from 'next/server';

const BATCH_INFERENCE_BASE_URL = 'http://98.80.0.197:8000';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    console.log('Proxying batch inference request:', {
      model_name: body.model_name,
      path_of_csv: body.path_of_csv,
      starting_id: body.starting_id
    });

    // Forward the request to the batch inference server
    const response = await fetch(`${BATCH_INFERENCE_BASE_URL}/infer_batched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Batch inference server error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Batch inference server error',
          details: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Batch inference started successfully:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error proxying batch inference request:', error);
    
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

