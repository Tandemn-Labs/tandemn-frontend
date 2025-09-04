import { NextRequest, NextResponse } from 'next/server';
import { getModelPricing, calculateCost, getModelById } from '@/config/models';

// GET /api/v1/pricing - Get pricing for all models
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('model');
    
    if (modelId) {
      // Get pricing for specific model
      const model = getModelById(modelId);
      if (!model) {
        return NextResponse.json(
          { error: `Model '${modelId}' not found` },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        data: {
          id: model.id,
          name: model.name,
          provider: model.provider,
          input_price_per_1m: model.input_price_per_1m,
          output_price_per_1m: model.output_price_per_1m,
          context_length: model.context_length
        }
      });
    }
    
    // Get pricing for all models
    const pricing = getModelPricing();
    return NextResponse.json({
      data: pricing,
      total: pricing.length
    });
  } catch (error) {
    console.error('Error in /api/v1/pricing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/v1/pricing/calculate - Calculate cost for specific usage
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model_id, input_tokens, output_tokens } = body;
    
    if (!model_id || input_tokens === undefined || output_tokens === undefined) {
      return NextResponse.json(
        { error: 'model_id, input_tokens, and output_tokens are required' },
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
    
    const totalCost = calculateCost(model_id, input_tokens, output_tokens);
    const inputCost = (input_tokens / 1000000) * model.input_price_per_1m;
    const outputCost = (output_tokens / 1000000) * model.output_price_per_1m;
    
    return NextResponse.json({
      data: {
        model_id,
        input_tokens,
        output_tokens,
        total_tokens: input_tokens + output_tokens,
        input_cost: Math.round(inputCost * 10000) / 10000,
        output_cost: Math.round(outputCost * 10000) / 10000,
        total_cost: totalCost,
        pricing: {
          input_price_per_1m: model.input_price_per_1m,
          output_price_per_1m: model.output_price_per_1m
        }
      }
    });
  } catch (error) {
    console.error('Error in /api/v1/pricing POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}