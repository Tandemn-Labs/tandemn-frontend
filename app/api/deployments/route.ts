import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/deployments
 * Proxies deployment status from the backend server
 */
export async function GET(_request: NextRequest) {
  try {
    const backendUrl = process.env.BATCH_INFERENCE_URL_LLAMA;
    
    if (!backendUrl) {
      console.warn('BATCH_INFERENCE_URL_LLAMA environment variable is not set');
      return NextResponse.json(
        { 
          error: 'Backend URL not configured',
          deployments: [] 
        },
        { status: 503 }
      );
    }

    // Remove trailing slash if present
    const baseUrl = backendUrl.replace(/\/$/, '');
    const deploymentsUrl = `${baseUrl}/deployments`;

    console.log(`Fetching deployments from: ${deploymentsUrl}`);

    const response = await fetch(deploymentsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`Backend deployment endpoint returned ${response.status}`);
      return NextResponse.json(
        { 
          error: `Backend returned ${response.status}`,
          deployments: [] 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Backend returns { deployments: [{ model_name, status }] }
    return NextResponse.json(
      {
        deployments: data.deployments || [],
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );

  } catch (error) {
    console.error('Error fetching deployments:', error);
    
    // Return empty deployments array on error to allow graceful degradation
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch deployments',
        deployments: [] 
      },
      { status: 500 }
    );
  }
}

