import { NextRequest, NextResponse } from 'next/server';
import { tandemnClient } from '@/lib/tandemn-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params;

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    console.log('Checking status for request:', requestId);

    // Get the inference status from tandemn backend
    const statusResponse = await tandemnClient.getInferenceStatus(requestId);
    
    console.log('Status response:', statusResponse);

    return NextResponse.json({
      request_id: statusResponse.request_id,
      status: statusResponse.status,
      result: statusResponse.result,
      processing_time: statusResponse.processing_time,
    });

  } catch (error) {
    console.error('Tandemn status check error:', error);
    return NextResponse.json(
      { error: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
