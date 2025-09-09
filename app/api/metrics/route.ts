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

    try {
      // Try to get real metrics data
      const summary = await ChatResponseService.getMetricsSummary(query);
      const recentResponses = await ChatResponseService.getChatResponses({
        ...query,
        limit: 50,
      });

      // If we have data, return it
      if (summary.totalRequests > 0 || recentResponses.length > 0) {
        return NextResponse.json({
          summary,
          recentResponses,
          query,
          dataSource: 'database'
        });
      }
    } catch (dbError) {
      console.log('Database unavailable, falling back to mock data:', dbError);
    }

    // Return mock data when no real data is available
    const mockSummary = {
      totalRequests: 1247,
      totalTokens: 485620,
      totalCost: 12.34,
      averageProcessingTime: 1450,
      requestsByBackend: {
        tandemn: 823,
        openrouter: 324,
        mock: 100,
      },
      requestsByModel: [
        { modelId: 'llama-3.3-70b-versatile', count: 456, totalTokens: 185420, totalCost: 4.85 },
        { modelId: 'gpt-4o-mini', count: 321, totalTokens: 142380, totalCost: 3.21 },
        { modelId: 'claude-3-haiku', count: 287, totalTokens: 98750, totalCost: 2.87 },
        { modelId: 'gemini-2.0-flash-exp', count: 183, totalTokens: 59070, totalCost: 1.41 },
      ],
      dailyStats: Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return {
          date: date.toISOString().split('T')[0],
          requests: Math.floor(Math.random() * 50) + 10,
          tokens: Math.floor(Math.random() * 15000) + 5000,
          cost: Math.random() * 2 + 0.5,
        };
      }),
    };

    const mockRecentResponses = Array.from({ length: 20 }, (_, i) => ({
      _id: `mock_${i}`,
      userId,
      modelId: ['llama-3.3-70b-versatile', 'gpt-4o-mini', 'claude-3-haiku'][i % 3],
      inputText: `Sample user query ${i + 1}...`,
      responseText: `Generated response for query ${i + 1}...`,
      backendUsed: ['tandemn', 'openrouter', 'mock'][i % 3] as 'tandemn' | 'openrouter' | 'mock',
      inputTokens: Math.floor(Math.random() * 100) + 50,
      outputTokens: Math.floor(Math.random() * 500) + 100,
      totalTokens: Math.floor(Math.random() * 600) + 150,
      inputCost: Math.random() * 0.05,
      outputCost: Math.random() * 0.15,
      totalCost: Math.random() * 0.20,
      processingTimeMs: Math.floor(Math.random() * 2000) + 500,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    }));

    return NextResponse.json({
      summary: mockSummary,
      recentResponses: mockRecentResponses,
      query,
      dataSource: 'mock'
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
