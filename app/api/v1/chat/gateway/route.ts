import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, chargeForUsage, getUserCredits, calculateTokenCost } from '@/lib/credits';
import { getAPIGateway } from '@/lib/gateway';
import { getQueueProcessor } from '@/lib/queue-processor';
import { db } from '@/mock/db';

export async function POST(request: NextRequest) {
  try {
    // Check if gateway is enabled
    const gatewayEnabled = process.env.GATEWAY_ENABLED === 'true';
    if (!gatewayEnabled) {
      return NextResponse.json(
        { error: 'API Gateway is disabled' },
        { status: 503 }
      );
    }

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

    // Pre-calculate tokens and cost
    let inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    let outputTokens = 25; // Estimate for cost calculation
    
    if (isBatch) {
      inputTokens *= 2;
      outputTokens *= 2;
    }

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
        { status: 402 }
      );
    }

    // Get gateway and processor instances
    const gateway = getAPIGateway();
    const processor = getQueueProcessor();

    // Check if we have available instances for this model
    const availableInstance = await gateway.getBestInstance(model);
    
    if (!availableInstance) {
      // No instances available, get queue status
      const queueStatus = await gateway.getQueueStatus(model);
      
      return NextResponse.json({
        error: 'No available instances for this model',
        queue_status: {
          position: queueStatus.length + 1,
          estimated_wait_time_ms: queueStatus.estimatedWaitTime,
          message: 'All instances are currently busy. Try again later.'
        },
        model_instances: gateway.getInstancesByModel(model).map(i => ({
          id: i.id.substring(0, 8),
          status: i.status,
          load: `${i.currentLoad}/${i.maxLoad}`,
          response_time: `${i.responseTimeMs}ms`
        }))
      }, { status: 503 });
    }

    // Queue the request
    const requestId = await gateway.queueRequest({
      modelId: model,
      payload: {
        model,
        messages,
        max_tokens,
        batch: isBatch
      },
      userId,
      priority: isBatch ? 2 : 1, // Batch requests have higher priority
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      retryCount: 0,
      maxRetries: 2,
    });

    // Wait for result (with streaming support in future)
    const result = await processor.waitForResult(requestId, 35000); // 35s timeout

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Request processing failed',
        request_id: requestId,
        instance_id: result.instanceId,
      }, { status: 500 });
    }

    // Extract actual token usage from the response
    const responseData = result.data;
    const actualInputTokens = responseData.usage?.prompt_tokens || inputTokens;
    const actualOutputTokens = responseData.usage?.completion_tokens || outputTokens;
    const actualCreditCost = calculateTokenCost(model, actualInputTokens, actualOutputTokens);

    // Charge credits based on actual usage
    const chargeSuccess = await chargeForUsage(model, actualInputTokens, actualOutputTokens, userId);

    if (!chargeSuccess) {
      return NextResponse.json(
        { error: 'Failed to charge credits' },
        { status: 500 }
      );
    }

    // Add gateway-specific information to the response
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
        queue_time_ms: responseData.instance_info ? 
          Date.now() - new Date().getTime() : undefined, // Approximate
        processed_by: 'api_gateway_v1',
      },
      batch_request: isBatch,
    };

    return NextResponse.json(enhancedResponse);

  } catch (error) {
    console.error('Error in /api/v1/chat/gateway:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}