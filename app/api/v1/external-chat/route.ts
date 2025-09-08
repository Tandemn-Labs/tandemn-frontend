import { NextRequest, NextResponse } from 'next/server';
import { externalChatAPI, convertMessages } from '@/lib/external-chat-api';
import { externalChatCompletionSchema } from '@/lib/zod-schemas';
import { validateAPIKey, chargeForUsage, getUserCredits, calculateTokenCost } from '@/lib/credits';

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

    const apiKey = authHeader.substring(7);
    
    // Validate API key
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = validation.userId;

    // Parse and validate request body
    const body = await request.json();
    
    try {
      const validatedRequest = externalChatCompletionSchema.parse(body);
      
      // Check if streaming is requested
      if (validatedRequest.stream) {
        return handleStreamingRequestWithFallback(validatedRequest, userId, request);
      } else {
        return handleNonStreamingRequestWithFallback(validatedRequest, userId, request);
      }
      
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validationError instanceof Error ? validationError.message : 'Validation failed'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in /api/v1/external-chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Try Tandem first, fallback to OpenRouter if Tandem fails
async function handleNonStreamingRequestWithFallback(
  validatedRequest: any,
  userId: string,
  request: NextRequest
): Promise<NextResponse> {
  try {
    // First, try Tandem's internal system
    console.log('Attempting Tandem internal chat...');
    const tandemResponse = await tryTandemChat(validatedRequest, userId, request);
    
    if (tandemResponse) {
      console.log('Tandem internal chat succeeded');
      return tandemResponse;
    }
    
    console.log('Tandem internal chat failed, trying OpenRouter fallback...');
    
    // Fallback to OpenRouter
    return await handleOpenRouterRequest(validatedRequest, userId, false);
    
  } catch (error) {
    console.error('Both Tandem and OpenRouter failed:', error);
    return NextResponse.json(
      { 
        error: 'All chat services are currently unavailable',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

// Try Tandem first, fallback to OpenRouter if Tandem fails (streaming)
async function handleStreamingRequestWithFallback(
  validatedRequest: any,
  userId: string,
  request: NextRequest
): Promise<NextResponse> {
  try {
    // First, try Tandem's internal system
    console.log('Attempting Tandem internal streaming chat...');
    const tandemResponse = await tryTandemChat(validatedRequest, userId, request);
    
    if (tandemResponse) {
      console.log('Tandem internal streaming chat succeeded');
      return tandemResponse;
    }
    
    console.log('Tandem internal streaming chat failed, trying OpenRouter fallback...');
    
    // Fallback to OpenRouter streaming
    return await handleOpenRouterRequest(validatedRequest, userId, true);
    
  } catch (error) {
    console.error('Both Tandem and OpenRouter streaming failed:', error);
    return NextResponse.json(
      { 
        error: 'All chat services are currently unavailable',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

// Try to use Tandem's internal chat system
async function tryTandemChat(
  validatedRequest: any,
  userId: string,
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    // Convert external request format to Tandem's internal format
    const tandemRequestBody = {
      model: 'meta/llama-3-3-70b-0', // Map to Tandem's internal model ID
      messages: validatedRequest.messages,
      max_tokens: validatedRequest.max_completion_tokens || 150,
      temperature: validatedRequest.temperature,
      top_p: validatedRequest.top_p,
      stream: validatedRequest.stream
    };

    // Create a new request to forward to Tandem's internal API
    const tandemRequest = new NextRequest(new URL('/api/v1/chat', request.url), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(tandemRequestBody),
    });

    // Import the POST handler from the internal chat route
    const { POST: tandemChatHandler } = await import('../chat/route');
    const tandemResponse = await tandemChatHandler(tandemRequest);
    
    // Check if the response is successful
    if (tandemResponse.status >= 200 && tandemResponse.status < 300) {
      // Add a flag to indicate this came from Tandem
      const responseData = await tandemResponse.json();
      return NextResponse.json({
        ...responseData,
        processing_source: 'tandem',
        fallback_used: false,
      });
    }
    
    console.log(`Tandem internal chat failed with status: ${tandemResponse.status}`);
    return null;
    
  } catch (error) {
    console.error('Error calling Tandem internal chat:', error);
    return null;
  }
}

// Handle OpenRouter request
async function handleOpenRouterRequest(
  validatedRequest: any,
  userId: string,
  isStreaming: boolean
): Promise<NextResponse> {
  // Estimate tokens for credit checking
  const inputTokens = Math.ceil(JSON.stringify(validatedRequest.messages).length / 4);
  const estimatedOutputTokens = validatedRequest.max_completion_tokens || 150;
  
  // Use OpenRouter pricing for Llama 3.3 70B (approximate)
  const estimatedCreditCost = calculateTokenCost('meta-llama/llama-3.3-70b-instruct', inputTokens, estimatedOutputTokens);
  const userCredits = await getUserCredits(userId);
  
  if (userCredits < estimatedCreditCost) {
    return NextResponse.json(
      { 
        error: `Insufficient credits. Estimated required: $${estimatedCreditCost.toFixed(4)}, Available: $${userCredits.toFixed(4)}`,
        credits_required: estimatedCreditCost,
        credits_available: userCredits,
      },
      { status: 402 }
    );
  }

  // Use the correct model ID for OpenRouter
  const openRouterRequest = {
    ...validatedRequest,
    model: 'meta-llama/llama-3.3-70b-instruct',
  };

  if (isStreaming) {
    return handleOpenRouterStreaming(openRouterRequest, userId, inputTokens);
  } else {
    return handleOpenRouterNonStreaming(openRouterRequest, userId, inputTokens);
  }
}

async function handleOpenRouterNonStreaming(
  request: any,
  userId: string,
  estimatedInputTokens: number
): Promise<NextResponse> {
  try {
    const response = await externalChatAPI.createChatCompletion(request);
    
    // Calculate actual costs based on response
    const actualInputTokens = response.usage.prompt_tokens || estimatedInputTokens;
    const actualOutputTokens = response.usage.completion_tokens || 50;
    const actualCreditCost = calculateTokenCost('meta-llama/llama-3.3-70b-instruct', actualInputTokens, actualOutputTokens);
    
    // Charge credits based on actual usage
    const chargeSuccess = await chargeForUsage('meta-llama/llama-3.3-70b-instruct', actualInputTokens, actualOutputTokens, userId);
    
    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500 }
      );
    }

    const userCredits = await getUserCredits(userId);

    // Return response with pricing info
    const enhancedResponse = {
      ...response,
      pricing: {
        credits_charged: actualCreditCost,
        credits_remaining: Math.round((userCredits - actualCreditCost) * 100) / 100,
        input_tokens: actualInputTokens,
        output_tokens: actualOutputTokens,
      },
      processing_source: 'openrouter',
      fallback_used: true,
    };

    return NextResponse.json(enhancedResponse);
    
  } catch (error) {
    console.error('OpenRouter API error:', error);
    throw error;
  }
}

async function handleOpenRouterStreaming(
  request: any,
  userId: string,
  estimatedInputTokens: number
): Promise<NextResponse> {
  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let totalOutputTokens = 0;

      try {
        await externalChatAPI.createStreamingChatCompletion(
          request,
          (chunk) => {
            // Count output tokens (rough estimation)
            if (chunk.choices?.[0]?.delta?.content) {
              totalOutputTokens += Math.ceil(chunk.choices[0].delta.content.length / 4);
            }
            
            // Forward chunk to client with fallback indicator
            const enhancedChunk = {
              ...chunk,
              processing_source: 'openrouter',
              fallback_used: true,
            };
            
            const data = `data: ${JSON.stringify(enhancedChunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          },
          (error) => {
            console.error('OpenRouter streaming error:', error);
            const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        );

        // Send completion message
        const completionData = `data: [DONE]\n\n`;
        controller.enqueue(encoder.encode(completionData));
        controller.close();

        // Charge credits after streaming is complete
        const actualCreditCost = calculateTokenCost('meta-llama/llama-3.3-70b-instruct', estimatedInputTokens, totalOutputTokens);
        await chargeForUsage('meta-llama/llama-3.3-70b-instruct', estimatedInputTokens, totalOutputTokens, userId);
        
      } catch (error) {
        console.error('OpenRouter streaming setup error:', error);
        const errorData = `data: ${JSON.stringify({ 
          error: 'OpenRouter streaming failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}