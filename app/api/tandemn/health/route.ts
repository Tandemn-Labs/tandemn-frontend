import { NextRequest, NextResponse } from 'next/server';
import { tandemnClient } from '@/lib/tandemn-client';

export async function GET(request: NextRequest) {
  try {
    console.log('Checking tandemn backend health...');

    // Get health status from tandemn backend
    const healthResponse = await tandemnClient.health();
    
    console.log('Health response:', healthResponse);

    return NextResponse.json({
      status: healthResponse.status,
      machines: healthResponse.machines,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Tandemn health check error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
