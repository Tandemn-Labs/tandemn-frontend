import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ChatResponseService } from '@/lib/services/chatResponseService';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const query = {
      userId: searchParams.get('userId') || userId,
      modelId: searchParams.get('modelId') || undefined,
      backendUsed: searchParams.get('backendUsed') as 'tandemn' | 'openrouter' | 'mock' | undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    // Get metrics summary
    const summary = await ChatResponseService.getMetricsSummary(query);
    
    // Get recent chat responses
    const recentResponses = await ChatResponseService.getChatResponses({
      ...query,
      limit: 50,
    });

    return NextResponse.json({
      summary,
      recentResponses,
      query,
    });
  } catch (error) {
    console.error('Error in /api/metrics:', error);
    
    // Check if it's a MongoDB connection error
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { 
          error: 'Database connection failed. Please check your MongoDB connection.',
          details: error.message 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
