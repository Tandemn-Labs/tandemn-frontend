import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/mock/db';
import { modelsQuerySchema } from '@/lib/zod-schemas';
import { sleep } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    // Add artificial latency for realistic feel
    await sleep(180);
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const queryParams = {
      q: searchParams.get('q') || undefined,
      modalities: searchParams.getAll('modalities') || undefined,
      series: searchParams.getAll('series') || undefined,
      contextMin: searchParams.get('contextMin') ? Number(searchParams.get('contextMin')) : undefined,
      contextMax: searchParams.get('contextMax') ? Number(searchParams.get('contextMax')) : undefined,
      promptPriceMax: searchParams.get('promptPriceMax') ? Number(searchParams.get('promptPriceMax')) : undefined,
      sort: searchParams.get('sort') || undefined,
      view: searchParams.get('view') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    };
    
    // Validate query parameters
    const validatedParams = modelsQuerySchema.parse(queryParams);
    
    // Get filtered models
    const result = db.getModels(validatedParams);
    
    return NextResponse.json({
      ...result,
      page: validatedParams.page || 1,
    });
  } catch (error) {
    console.error('Error in /api/models:', error);
    return NextResponse.json(
      { error: 'Invalid query parameters' },
      { status: 400 }
    );
  }
}
