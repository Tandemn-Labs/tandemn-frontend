import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ChatResponseService } from '@/lib/services/chatResponseService';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Get all chat responses for this user to extract unique models
      const responses = await ChatResponseService.getChatResponses({
        userId,
        limit: 1000, // Get a large sample to find all models
      });

      // Extract unique model IDs
      const modelIds = new Set<string>();
      responses.forEach(response => {
        if (response.modelId) {
          modelIds.add(response.modelId);
        }
      });

      // Convert to array and sort
      const models = Array.from(modelIds).sort();

      return NextResponse.json({
        models,
        count: models.length
      });
    } catch (dbError) {
      console.log('Database unavailable for models:', dbError);
      
      // Return empty models list when database is unavailable
      return NextResponse.json({
        models: [],
        count: 0
      });
    }
  } catch (error) {
    console.error('Error in /api/metrics/models:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch models',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
