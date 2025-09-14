import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, chargeForUsage, getUserCredits } from '@/lib/credits';
import { calculateCost } from '@/config/models';
import { getSimpleGateway } from '@/lib/simple-gateway';
import { getAPIGateway } from '@/lib/gateway';
import { db } from '@/mock/db';
import { getModelEndpoint } from '@/config/model-endpoints';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 200,
    headers: corsHeaders
  });
}

export async function POST(request: NextRequest) {
  try {
    // Re-enable gateway with fixed Redis-free implementation
    const gatewayEnabled = process.env.GATEWAY_ENABLED === 'true';
    
    if (gatewayEnabled) {
      console.log('Using simple gateway processing');
      try {
        const body = await request.json();
        return await processWithSimpleGateway(request, body);
      } catch (error) {
        console.warn('Simple gateway error, falling back to direct processing:', error);
      }
    }

    // Fall back to direct processing
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY' },
        { status: 401, headers: corsHeaders }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate API key
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = validation.userId;

    // Parse request body
    const body = await request.json();
    const { model, messages, max_tokens = 150, stream = false } = body;

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: model and messages array' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if this is a streaming request
    if (stream) {
      return handleStreamingRequest(request, body, userId);
    }

    // Check for batch parameter (affects token multiplier)
    const { searchParams } = new URL(request.url);
    const isBatch = searchParams.get('batch') === '1';

    // Get the model info
    const modelInfo = db.getModelById(model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model '${model}' not found` },
        { status: 404, headers: corsHeaders }
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
    const creditCost = calculateCost(model, inputTokens, outputTokens);

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
        { status: 402, headers: corsHeaders } // Payment Required
      );
    }

    // Charge credits based on token usage
    const chargeSuccess = await chargeForUsage(model, inputTokens, outputTokens, userId);

    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500, headers: corsHeaders }
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
        credits_remaining: userCredits - creditCost, // Full precision, no rounding
        input_cost: (inputTokens / 1000000) * modelInfo.promptPrice, // Full precision, no rounding
        output_cost: (outputTokens / 1000000) * modelInfo.completionPrice, // Full precision, no rounding
        input_price_per_1m_tokens: modelInfo.promptPrice,
        output_price_per_1m_tokens: modelInfo.completionPrice,
      },
      batch_request: isBatch,
      processing_mode: 'direct', // Indicate direct processing
    };

    // Add minimal artificial latency for testing
    await new Promise(resolve => setTimeout(resolve, Math.min(modelInfo.latencyMs || 100, 100)));

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in /api/v1/chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Simple gateway processing without Redis
async function processWithSimpleGateway(request: NextRequest, body: any): Promise<NextResponse> {
  // Extract API key
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401, headers: corsHeaders }
    );
  }

  const apiKey = authHeader.substring(7);
  const validation = await validateAPIKey(apiKey);
  if (!validation.valid || !validation.userId) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401, headers: corsHeaders });
  }

  const { model, messages, max_tokens = 150 } = body;
  if (!model || !messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: 'Missing required fields: model and messages array' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Get model info
  const modelInfo = db.getModelById(model);
  if (!modelInfo) {
    return NextResponse.json({ error: `Model '${model}' not found` }, { status: 404, headers: corsHeaders });
  }

  // Check machine availability
  const gateway = getSimpleGateway();
  const result = gateway.processRequest(model);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error,
      processing_mode: 'gateway'
    }, { status: 503, headers: corsHeaders });
  }

  // Calculate costs
  const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
  const outputTokens = Math.ceil(15); // Estimated response length
  const creditCost = calculateCost(model, inputTokens, outputTokens);
  const userCredits = await getUserCredits(validation.userId);
  
  if (userCredits < creditCost) {
    return NextResponse.json(
      { 
        error: `Insufficient credits. Required: $${creditCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
        credits_required: creditCost,
        credits_available: userCredits,
      },
      { status: 402, headers: corsHeaders }
    );
  }

  // Charge credits
  const chargeSuccess = await chargeForUsage(model, inputTokens, outputTokens, validation.userId);
  if (!chargeSuccess) {
    return NextResponse.json({ error: 'Failed to charge credits' }, { status: 500, headers: corsHeaders });
  }

  // Generate response
  const userMessage = messages[messages.length - 1]?.content || '';
  const responseContent = `Hello from Machine ${result.machine!.machineNumber}! (${result.machine!.modelId}) - Processing: "${userMessage.substring(0, 30)}${userMessage.length > 30 ? '...' : ''}"`;
  
  // Add small delay to simulate processing
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

  return NextResponse.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: responseContent,
      },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
    pricing: {
      credits_charged: creditCost,
      credits_remaining: userCredits - creditCost, // Full precision, no rounding
    },
    gateway: {
      machine_number: result.machine!.machineNumber,
      processing_mode: 'simple_gateway',
      healthy_machines: gateway.getHealthyMachines().length,
      total_machines: gateway.getMachines().length,
    },
    batch_request: false,
  }, { headers: corsHeaders });
}

// Forward request to gateway processing (Redis-free version)
async function forwardToGateway(request: NextRequest, body: any): Promise<NextResponse> {
  console.log('forwardToGateway called');
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY' },
        { status: 401, headers: corsHeaders }
      );
    }

    const apiKey = authHeader.substring(7);
    console.log('Validating API key...');
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = validation.userId;
    const { model, messages, max_tokens = 150 } = body;

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: model and messages array' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for batch parameter
    const { searchParams } = new URL(request.url);
    const isBatch = searchParams.get('batch') === '1';

    // Get model info for cost calculation
    console.log('Getting model info...');
    const modelInfo = db.getModelById(model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model '${model}' not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    // Pre-calculate tokens and cost
    let inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    let outputTokens = 25;
    
    if (isBatch) {
      inputTokens *= 2;
      outputTokens *= 2;
    }

    console.log('Calculating costs...');
    const creditCost = calculateCost(model, inputTokens, outputTokens);
    const userCredits = await getUserCredits(userId);
    
    if (userCredits < creditCost) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. Required: $${creditCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
          credits_required: creditCost,
          credits_available: userCredits,
        },
        { status: 402, headers: corsHeaders }
      );
    }

    // Use gateway for processing (direct execution only, no queuing)
    console.log('Getting gateway instance...');
    const gateway = getAPIGateway();

    // Try to get an available instance and process directly
    console.log('Getting best instance for model:', model);
    const availableInstance = await gateway.getBestInstance(model);
    if (!availableInstance) {
      console.log('No available instances found');
      return NextResponse.json({
        error: 'All model instances are currently busy or offline',
        queue_status: {
          position: 1,
          estimated_wait_time_ms: 1000,
        },
        processing_mode: 'gateway'
      }, { status: 503, headers: corsHeaders });
    }

    console.log('Found available instance:', availableInstance.id, 'status:', availableInstance.status);

    // Process request directly on available instance
    const requestId = `req-${Date.now()}`;
    console.log('Executing request on instance...');
    const result = await gateway.executeRequest(availableInstance.id, {
      id: requestId,
      modelId: model,
      payload: { model, messages, max_tokens, batch: isBatch },
      userId,
      priority: isBatch ? 2 : 1,
      createdAt: new Date().toISOString(),
      timeout: 30000,
      retryCount: 0,
      maxRetries: 2,
    });
    
    console.log('Gateway execution result:', result.success);
    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Gateway processing failed',
        request_id: requestId,
        processing_mode: 'gateway'
      }, { status: 500, headers: corsHeaders });
    }

    // Calculate actual costs and charge credits
    console.log('Charging credits...');
    const responseData = result.data;
    const actualInputTokens = responseData.usage?.prompt_tokens || inputTokens;
    const actualOutputTokens = responseData.usage?.completion_tokens || outputTokens;
    const actualCreditCost = calculateCost(model, actualInputTokens, actualOutputTokens);

    const chargeSuccess = await chargeForUsage(model, actualInputTokens, actualOutputTokens, userId);
    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Return enhanced response
    console.log('Returning gateway response');
    const enhancedResponse = {
      ...responseData,
      pricing: {
        credits_charged: actualCreditCost,
        credits_remaining: userCredits - actualCreditCost, // Full precision, no rounding
        input_cost: (actualInputTokens / 1000000) * modelInfo.promptPrice, // Full precision, no rounding
        output_cost: (actualOutputTokens / 1000000) * modelInfo.completionPrice, // Full precision, no rounding
        input_price_per_1m_tokens: modelInfo.promptPrice,
        output_price_per_1m_tokens: modelInfo.completionPrice,
      },
      gateway: {
        request_id: requestId,
        instance_id: result.instanceId,
        processing_mode: 'gateway',
      },
      batch_request: isBatch,
    };

    return NextResponse.json(enhancedResponse, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Gateway forwarding error:', error);
    throw error; // Let the main function handle fallback
  }
}

// Handle streaming requests using direct model endpoints
async function handleStreamingRequest(request: NextRequest, body: any, userId: string): Promise<Response> {
  const { model, messages, max_tokens = 2000, temperature, top_p, top_k, min_p } = body;
  
  // Get the model endpoint configuration
  const modelConfig = getModelEndpoint(model);
  if (!modelConfig) {
    return NextResponse.json(
      { error: `Model '${model}' endpoint not configured` },
      { status: 404, headers: corsHeaders }
    );
  }

  // Get model info for pricing
  const modelInfo = db.getModelById(model);
  if (!modelInfo) {
    return NextResponse.json(
      { error: `Model '${model}' not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  // Calculate estimated costs
  const conversationText = JSON.stringify(messages);
  const inputTokens = Math.ceil(conversationText.length / 4);
  const estimatedOutputTokens = Math.ceil(max_tokens / 4);
  const estimatedCost = calculateCost(model, inputTokens, estimatedOutputTokens);

  // Check user credits
  const userCredits = await getUserCredits(userId);
  if (userCredits < estimatedCost) {
    return NextResponse.json(
      { 
        error: `Insufficient credits. Required: $${estimatedCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
        credits_required: estimatedCost,
        credits_available: userCredits,
      },
      { status: 402, headers: corsHeaders }
    );
  }

  // Prepare messages with system prompt if needed
  let processedMessages = [...messages];
  if (modelConfig.systemPrompt) {
    // Check if system message already exists
    if (processedMessages.length === 0 || processedMessages[0].role !== 'system') {
      processedMessages = [
        { role: 'system', content: modelConfig.systemPrompt },
        ...processedMessages
      ];
    }
  }

  // Build request payload using model config
  const requestPayload = {
    model: model,
    messages: processedMessages,
    stream: true,
    ...modelConfig.requestParams,
    // Override with request params if provided
    ...(temperature !== undefined && { temperature }),
    ...(top_p !== undefined && { top_p }),
    ...(top_k !== undefined && { top_k }),
    ...(min_p !== undefined && { min_p }),
    ...(max_tokens !== undefined && { max_completion_tokens: max_tokens }),
  };

  try {
    console.log(`🔧 V1_CHAT: Streaming to ${modelConfig.endpoint} for model ${model}`);
    
    // Make streaming request to model endpoint
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Model endpoint error: ${response.status} ${response.statusText} - ${errorText}`);
      return NextResponse.json(
        { error: `Model endpoint failed: ${response.statusText}` },
        { status: 500, headers: corsHeaders }
      );
    }

    // Pass through the streaming response
    const encoder = new TextEncoder();
    let totalOutputTokens = 0;
    let responseContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          controller.close();
          return;
        }

        try {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              if (trimmedLine === '') continue;
              if (trimmedLine === 'data: [DONE]') {
                // Send final [DONE] message
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                break;
              }
              if (!trimmedLine.startsWith('data: ')) continue;
              
              // Parse and potentially modify the chunk
              try {
                const jsonData = trimmedLine.slice(6);
                const chunk = JSON.parse(jsonData);
                
                // Extract content for token counting
                const content = chunk.choices?.[0]?.delta?.content;
                if (content) {
                  responseContent += content;
                }
                
                // Pass through the chunk
                controller.enqueue(encoder.encode(trimmedLine + '\n\n'));
              } catch (parseError) {
                // Pass through unparseable chunks as-is
                controller.enqueue(encoder.encode(trimmedLine + '\n\n'));
              }
            }
          }
          
          // Calculate actual costs and charge
          totalOutputTokens = Math.ceil(responseContent.length / 4);
          const actualCost = calculateCost(model, inputTokens, totalOutputTokens);
          
          // Charge credits based on actual usage
          await chargeForUsage(model, inputTokens, totalOutputTokens, userId);
          
          console.log(`✅ V1_CHAT: Streaming completed. Input: ${inputTokens}, Output: ${totalOutputTokens}, Cost: $${actualCost.toFixed(4)}`);
          
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('Streaming request failed:', error);
    return NextResponse.json(
      { error: 'Failed to connect to model endpoint' },
      { status: 500, headers: corsHeaders }
    );
  }
}