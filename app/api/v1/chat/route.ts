import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, chargeForUsage, getUserCredits, calculateTokenCost } from '@/lib/credits';
import { db } from '@/mock/db';

export async function POST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate API key
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = validation.userId;

    // Parse request body
    const body = await request.json();
    const { model, messages, max_tokens = 150 } = body;

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: model and messages array' },
        { status: 400 }
      );
    }

    // Check for batch parameter (affects token multiplier)
    const { searchParams } = new URL(request.url);
    const isBatch = searchParams.get('batch') === '1';

    // Get the model info
    const modelInfo = db.getModelById(model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model '${model}' not found` },
        { status: 404 }
      );
    }

    // Generate mock response first to calculate tokens
    const userMessage = messages[messages.length - 1]?.content || '';
    const mockResponses = [
      `I'm ${modelInfo.name}, processing your request: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`,
      `Based on my training data, I can help you with this query. Using ${modelInfo.vendor}'s ${modelInfo.name} model.`,
      `Hello! I'm ${modelInfo.name} with ${modelInfo.context.toLocaleString()} tokens of context. Let me assist you.`,
      `Processing your request with ${modelInfo.name}. ${isBatch ? 'This is a batch request.' : 'Standard processing mode.'}`,
    ];

    const responseContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // Calculate token usage (mock calculation)
    let inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    let outputTokens = Math.ceil(responseContent.length / 4);
    
    // Apply batch multiplier (2x tokens for batch requests)
    if (isBatch) {
      inputTokens *= 2;
      outputTokens *= 2;
    }
    
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost based on tokens
    const creditCost = calculateTokenCost(model, inputTokens, outputTokens);

    // Check user credits
    const userCredits = await getUserCredits(userId);
    if (userCredits < creditCost) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. Required: $${creditCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
          credits_required: creditCost,
          credits_available: userCredits,
          token_breakdown: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            input_price_per_1m: modelInfo.promptPrice,
            output_price_per_1m: modelInfo.completionPrice
          }
        },
        { status: 402 } // Payment Required
      );
    }

    // Charge credits based on token usage
    const chargeSuccess = await chargeForUsage(model, inputTokens, outputTokens, userId);

    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500 }
      );
    }


    // Return OpenAI-compatible response
    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: totalTokens,
      },
      // Enhanced pricing information
      pricing: {
        credits_charged: creditCost,
        credits_remaining: Math.round((userCredits - creditCost) * 100) / 100,
        input_cost: Math.round(((inputTokens / 1000000) * modelInfo.promptPrice) * 100) / 100,
        output_cost: Math.round(((outputTokens / 1000000) * modelInfo.completionPrice) * 100) / 100,
        input_price_per_1m_tokens: modelInfo.promptPrice,
        output_price_per_1m_tokens: modelInfo.completionPrice,
      },
      batch_request: isBatch,
    };

    // Add artificial latency
    await new Promise(resolve => setTimeout(resolve, modelInfo.latencyMs || 500));

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in /api/v1/chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}