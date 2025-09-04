import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, getUserCredits, deductCredits, addTransaction } from '@/lib/credits';
import { getModelById, calculateCost } from '@/config/models';

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
    const { model, messages, stream = false } = body;

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: model and messages array' },
        { status: 400 }
      );
    }

    // Get the model info
    const modelInfo = getModelById(model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model '${model}' not found. Available models: claude-3-5-sonnet, gpt-4o, gemini-1.5-pro, llama-3.1-405b, mixtral-8x22b` },
        { status: 404 }
      );
    }

    // Check if streaming is requested (not supported in mock)
    if (stream) {
      return NextResponse.json(
        { error: 'Streaming not supported in mock implementation' },
        { status: 400 }
      );
    }

    // Calculate input tokens (rough estimate: ~4 characters per token)
    const inputText = JSON.stringify(messages);
    const inputTokens = Math.ceil(inputText.length / 4);
    
    // Generate mock response based on model capabilities
    const userMessage = messages[messages.length - 1]?.content || '';
    const mockResponses = [
      `Hello! I'm ${modelInfo.name} by ${modelInfo.provider}. I can help you with: ${modelInfo.capabilities.join(', ')}. You asked: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`,
      `This is ${modelInfo.name} responding with my ${modelInfo.context_length.toLocaleString()} token context window. I'll assist you with your request about "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`,
      `As ${modelInfo.name}, I can process up to ${modelInfo.max_tokens.toLocaleString()} output tokens. Let me help you with: "${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}"`,
    ];
    
    const responseContent = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    const outputTokens = Math.ceil(responseContent.length / 4);
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost using our pricing model
    const cost = calculateCost(model, inputTokens, outputTokens);

    // Check user balance
    const userBalance = await getUserCredits(userId);
    if (userBalance < cost) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. Required: $${cost.toFixed(4)}, Available: $${userBalance.toFixed(4)}`,
          required_credits: cost,
          available_credits: userBalance,
          token_breakdown: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            input_price_per_1m: modelInfo.input_price_per_1m,
            output_price_per_1m: modelInfo.output_price_per_1m,
            total_cost: cost
          }
        },
        { status: 402 } // Payment Required
      );
    }

    // Charge user credits
    const chargeSuccess = await deductCredits(userId, cost);
    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500 }
      );
    }

    // Add transaction record
    await addTransaction(userId, {
      type: 'usage_charge',
      amount: -cost,
      description: `${modelInfo.name} - ${totalTokens} tokens`,
      status: 'completed',
      metadata: {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens
      }
    });

    // Add model-specific latency simulation
    const baseLatency = {
      'claude-3-5-sonnet': 800,
      'gpt-4o': 600,
      'gemini-1.5-pro': 1200,
      'llama-3.1-405b': 400,
      'mixtral-8x22b': 200
    };
    
    const latency = baseLatency[model as keyof typeof baseLatency] || 500;
    await new Promise(resolve => setTimeout(resolve, Math.random() * latency + 100));

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
      // Tandemn-specific pricing info
      billing: {
        credits_charged: cost,
        credits_remaining: userBalance - cost,
        input_cost: Math.round(((inputTokens / 1000000) * modelInfo.input_price_per_1m) * 10000) / 10000,
        output_cost: Math.round(((outputTokens / 1000000) * modelInfo.output_price_per_1m) * 10000) / 10000,
        pricing: {
          input_price_per_1m_tokens: modelInfo.input_price_per_1m,
          output_price_per_1m_tokens: modelInfo.output_price_per_1m,
        },
      },
      model_info: {
        provider: modelInfo.provider,
        context_length: modelInfo.context_length,
        capabilities: modelInfo.capabilities,
        max_tokens: modelInfo.max_tokens
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in /api/v1/chat/complete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}