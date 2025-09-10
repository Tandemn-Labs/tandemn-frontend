import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/mock/db';
import { modelsQuerySchema } from '@/lib/zod-schemas';
import { sleep } from '@/lib/utils';
import { getAllModels } from '@/config/models';

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
    
    // Get only our Tandemn models instead of 500 generated ones
    const tandemnModels = getAllModels();
    
    // Convert Tandemn models to the format expected by the frontend
    const items = tandemnModels.map(model => ({
      id: model.id,
      name: model.name,
      vendor: model.provider, // Map provider to vendor
      description: model.description,
      context: model.context_length,
      promptPrice: model.input_price_per_1m,
      completionPrice: model.output_price_per_1m,
      maxTokens: model.max_tokens,
      capabilities: model.capabilities,
      modalities: ['text'], // All our models support text
      latencyMs: 1000, // Default latency
      tokensPerWeek: 100000, // Mock popularity
      weeklyGrowthPct: 5.2, // Mock growth
      series: model.provider.toLowerCase(), // Use provider as series
    }));
    
    // Apply basic filtering (simplified)
    let filtered = items;
    if (validatedParams.q) {
      const query = validatedParams.q.toLowerCase();
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(query) ||
        model.vendor.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query)
      );
    }
    
    // Apply pagination
    const page = validatedParams.page || 1;
    const limit = validatedParams.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = filtered.slice(startIndex, endIndex);
    
    return NextResponse.json({
      items: paginatedItems,
      total: filtered.length,
      hasMore: endIndex < filtered.length,
      page: page,
    });
  } catch (error) {
    console.error('Error in /api/models:', error);
    return NextResponse.json(
      { error: 'Invalid query parameters' },
      { status: 400 }
    );
  }
}
