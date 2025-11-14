import { NextRequest, NextResponse } from 'next/server';
import { getAllModels, getModelById } from '@/config/models';

// GET /api/v1/models - List all available models
export async function GET(_request: NextRequest) {
  try {
    const models = getAllModels();
    
    return NextResponse.json(
      {
        data: models,
        total: models.length
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/v1/models:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/v1/models/{model_id}/info - Get specific model info (alternative endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model_id } = body;
    
    if (!model_id) {
      return NextResponse.json(
        { error: 'model_id is required' },
        { status: 400 }
      );
    }
    
    const model = getModelById(model_id);
    if (!model) {
      return NextResponse.json(
        { error: `Model '${model_id}' not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ data: model });
  } catch (error) {
    console.error('Error in /api/v1/models POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}