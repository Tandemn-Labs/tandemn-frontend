import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, chargeForUsage, getUserCredits, calculateTokenCost } from '@/lib/credits';
import { getSimpleGateway } from '@/lib/simple-gateway';
import { getAPIGateway } from '@/lib/gateway';
import { db } from '@/mock/db';

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
      processing_mode: 'direct', // Indicate direct processing
    };

    // Add minimal artificial latency for testing
    await new Promise(resolve => setTimeout(resolve, Math.min(modelInfo.latencyMs || 100, 100)));

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in /api/v1/chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
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
      { status: 401 }
    );
  }

  const apiKey = authHeader.substring(7);
  const validation = await validateAPIKey(apiKey);
  if (!validation.valid || !validation.userId) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { model, messages, max_tokens = 150 } = body;
  if (!model || !messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: 'Missing required fields: model and messages array' },
      { status: 400 }
    );
  }

  // Get model info
  const modelInfo = db.getModelById(model);
  if (!modelInfo) {
    return NextResponse.json({ error: `Model '${model}' not found` }, { status: 404 });
  }

  // Check machine availability
  const gateway = getSimpleGateway();
  const result = gateway.processRequest(model);
  
  if (!result.success) {
    return NextResponse.json({
      error: result.error,
      processing_mode: 'gateway'
    }, { status: 503 });
  }

  // Calculate costs
  const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
  const outputTokens = Math.ceil(15); // Estimated response length
  const creditCost = calculateTokenCost(model, inputTokens, outputTokens);
  const userCredits = await getUserCredits(validation.userId);
  
  if (userCredits < creditCost) {
    return NextResponse.json(
      { 
        error: `Insufficient credits. Required: $${creditCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
        credits_required: creditCost,
        credits_available: userCredits,
      },
      { status: 402 }
    );
  }

  // Charge credits
  const chargeSuccess = await chargeForUsage(model, inputTokens, outputTokens, validation.userId);
  if (!chargeSuccess) {
    return NextResponse.json({ error: 'Failed to charge credits' }, { status: 500 });
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
      credits_remaining: Math.round((userCredits - creditCost) * 100) / 100,
    },
    gateway: {
      machine_number: result.machine!.machineNumber,
      processing_mode: 'simple_gateway',
      healthy_machines: gateway.getHealthyMachines().length,
      total_machines: gateway.getMachines().length,
    },
    batch_request: false,
  });
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
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    console.log('Validating API key...');
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = validation.userId;
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

    // Get model info for cost calculation
    console.log('Getting model info...');
    const modelInfo = db.getModelById(model);
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model '${model}' not found` },
        { status: 404 }
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
    const creditCost = calculateTokenCost(model, inputTokens, outputTokens);
    const userCredits = await getUserCredits(userId);
    
    if (userCredits < creditCost) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. Required: $${creditCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
          credits_required: creditCost,
          credits_available: userCredits,
        },
        { status: 402 }
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
      }, { status: 503 });
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
      }, { status: 500 });
    }

    // Calculate actual costs and charge credits
    console.log('Charging credits...');
    const responseData = result.data;
    const actualInputTokens = responseData.usage?.prompt_tokens || inputTokens;
    const actualOutputTokens = responseData.usage?.completion_tokens || outputTokens;
    const actualCreditCost = calculateTokenCost(model, actualInputTokens, actualOutputTokens);

    const chargeSuccess = await chargeForUsage(model, actualInputTokens, actualOutputTokens, userId);
    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500 }
      );
    }

    // Return enhanced response
    console.log('Returning gateway response');
    const enhancedResponse = {
      ...responseData,
      pricing: {
        credits_charged: actualCreditCost,
        credits_remaining: Math.round((userCredits - actualCreditCost) * 100) / 100,
        input_cost: Math.round(((actualInputTokens / 1000000) * modelInfo.promptPrice) * 100) / 100,
        output_cost: Math.round(((actualOutputTokens / 1000000) * modelInfo.completionPrice) * 100) / 100,
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

    return NextResponse.json(enhancedResponse);
    
  } catch (error) {
    console.error('Gateway forwarding error:', error);
    throw error; // Let the main function handle fallback
  }
}