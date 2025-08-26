import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, chargeCredits, getUserCredits } from '@/lib/credits';
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

    // Check for batch parameter
    const { searchParams } = new URL(request.url);
    const isBatch = searchParams.get('batch') === '1';
    const creditCost = isBatch ? 2 : 1;

    // Check user credits
    const userCredits = await getUserCredits(userId);
    if (userCredits < creditCost) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. Required: ${creditCost}, Available: ${userCredits}`,
          credits_required: creditCost,
          credits_available: userCredits
        },
        { status: 402 } // Payment Required
      );
    }

    // Get the model info
    const modelInfo = db.getModelById(model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model '${model}' not found` },
        { status: 404 }
      );
    }

    // Charge credits before processing
    const description = isBatch ? `Batch API call - ${model}` : `API call - ${model}`;
    const chargeSuccess = await chargeCredits(creditCost, description, userId, {
      model,
      batch: isBatch,
      keyId: validation.keyInfo?.id,
    });

    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500 }
      );
    }

    // Generate mock response
    const userMessage = messages[messages.length - 1]?.content || '';
    const mockResponses = [
      `I'm ${modelInfo.name}, processing your request: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`,
      `Based on my training data, I can help you with this query. Using ${modelInfo.vendor}'s ${modelInfo.name} model.`,
      `Hello! I'm ${modelInfo.name} with ${modelInfo.context.toLocaleString()} tokens of context. Let me assist you.`,
      `Processing your request with ${modelInfo.name}. ${isBatch ? 'This is a batch request.' : 'Standard processing mode.'}`,
    ];

    const responseContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // Calculate token usage (mock calculation)
    const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    const outputTokens = Math.ceil(responseContent.length / 4);
    const totalTokens = inputTokens + outputTokens;

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
      credits_charged: creditCost,
      credits_remaining: userCredits - creditCost,
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