import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, getUserCredits, deductCredits, addTransaction } from '@/lib/credits';
import { getModelById, calculateCost } from '@/config/models';
import { getModelEndpoint } from '@/config/model-endpoints';

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
      const availableModels = ['casperhansen/deepseek-r1-distill-llama-70b-awq', 'Qwen/Qwen3-32B-AWQ', 'btbtyler09/Devstral-Small-2507-AWQ', 'casperhansen/llama-3.3-70b-instruct-awq'];
      return NextResponse.json(
        { error: `Model '${model}' not found. Available models: ${availableModels.join(', ')}` },
        { status: 404 }
      );
    }

    // Get the model endpoint configuration
    const endpointConfig = getModelEndpoint(model);
    if (!endpointConfig) {
      return NextResponse.json(
        { error: `Model '${model}' is not configured with an endpoint` },
        { status: 500 }
      );
    }

    // Prepare messages for the backend request
    let backendMessages = [...messages];
    
    // Add system prompt if specified in endpoint config and not already present
    if (endpointConfig.systemPrompt) {
      const hasSystemMessage = backendMessages.some(msg => msg.role === 'system');
      if (!hasSystemMessage) {
        backendMessages = [{ role: 'system', content: endpointConfig.systemPrompt }, ...backendMessages];
      }
    }

    // Prepare the request for the backend
    const backendRequest = {
      model: model,
      messages: backendMessages,
      stream: stream,
      ...endpointConfig.requestParams
    };

    // Calculate estimated input tokens for cost calculation (rough estimate: ~4 characters per token)
    const inputText = JSON.stringify(backendMessages);
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

    // Check user balance with estimated minimum cost
    const userBalance = await getUserCredits(userId);
    const minEstimatedCost = calculateCost(model, estimatedInputTokens, 10); // Estimate minimum 10 output tokens
    
    if (userBalance < minEstimatedCost) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. Minimum required: $${minEstimatedCost.toFixed(4)}, Available: $${userBalance.toFixed(4)}`,
          required_credits: minEstimatedCost,
          available_credits: userBalance,
          token_breakdown: {
            estimated_input_tokens: estimatedInputTokens,
            estimated_min_output_tokens: 10,
            input_price_per_1m: modelInfo.input_price_per_1m,
            output_price_per_1m: modelInfo.output_price_per_1m,
            estimated_min_cost: minEstimatedCost
          }
        },
        { status: 402 } // Payment Required
      );
    }

    try {
      // Make request to the model's specific endpoint
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (stream) {
        headers['Accept'] = 'text/event-stream';
        headers['Cache-Control'] = 'no-cache';
      } else {
        headers['Accept'] = 'application/json';
      }

      const response = await fetch(endpointConfig.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(backendRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Backend API error (${response.status}):`, errorText);
        return NextResponse.json(
          { error: `Backend API error: ${response.status} ${response.statusText}` },
          { status: 502 }
        );
      }

      if (stream) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        if (!reader) {
          return NextResponse.json(
            { error: 'Failed to get response stream' },
            { status: 500 }
          );
        }

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let accumulatedContent = '';

        const stream = new ReadableStream({
          async start(controller) {
            try {
              let buffer = '';
              
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  // Calculate final cost and charge user
                  const actualCost = calculateCost(model, totalInputTokens, totalOutputTokens);
                  
                  // Charge user for actual usage
                  await deductCredits(userId, actualCost);
                  
                  // Add transaction record
                  await addTransaction(userId, {
                    type: 'usage_charge',
                    amount: -actualCost,
                    description: `${modelInfo.name} - ${totalInputTokens + totalOutputTokens} tokens (streaming)`,
                    status: 'completed',
                    metadata: {
                      model,
                      input_tokens: totalInputTokens,
                      output_tokens: totalOutputTokens,
                      total_tokens: totalInputTokens + totalOutputTokens,
                      streaming: true
                    }
                  });
                  
                  break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  const trimmedLine = line.trim();
                  
                  if (trimmedLine === '') continue;
                  if (trimmedLine === 'data: [DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    continue;
                  }
                  if (!trimmedLine.startsWith('data: ')) continue;
                  
                  try {
                    const jsonData = trimmedLine.slice(6);
                    const chunk = JSON.parse(jsonData);
                    
                    // Extract token usage from chunk if available
                    if (chunk.usage) {
                      totalInputTokens = chunk.usage.prompt_tokens || totalInputTokens;
                      totalOutputTokens = chunk.usage.completion_tokens || totalOutputTokens;
                    }
                    
                    // Accumulate content for token estimation
                    if (chunk.choices?.[0]?.delta?.content) {
                      accumulatedContent += chunk.choices[0].delta.content;
                    }
                    
                    controller.enqueue(encoder.encode(`${trimmedLine}\n\n`));
                  } catch (parseError) {
                    console.warn('Failed to parse streaming chunk:', trimmedLine);
                    controller.enqueue(encoder.encode(`${trimmedLine}\n\n`));
                  }
                }
              }
            } catch (error) {
              console.error('Streaming error:', error);
              controller.error(error);
            } finally {
              controller.close();
              reader.releaseLock();
            }
          }
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Handle non-streaming response
        const result = await response.json();
        
        // Extract token usage from response
        const inputTokens = result.usage?.prompt_tokens || estimatedInputTokens;
        const outputTokens = result.usage?.completion_tokens || Math.ceil((result.choices?.[0]?.message?.content?.length || 0) / 4);
        const totalTokens = inputTokens + outputTokens;
        
        // Calculate actual cost
        const actualCost = calculateCost(model, inputTokens, outputTokens);
        
        // Charge user for actual usage
        const chargeSuccess = await deductCredits(userId, actualCost);
        if (!chargeSuccess) {
          return NextResponse.json(
            { error: 'Failed to charge credits' },
            { status: 500 }
          );
        }
        
        // Add transaction record
        await addTransaction(userId, {
          type: 'usage_charge',
          amount: -actualCost,
          description: `${modelInfo.name} - ${totalTokens} tokens`,
          status: 'completed',
          metadata: {
            model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens
          }
        });
        
        // Add Tandemn-specific billing info to response
        result.billing = {
          credits_charged: actualCost,
          credits_remaining: userBalance - actualCost,
          input_cost: Math.round(((inputTokens / 1000000) * modelInfo.input_price_per_1m) * 10000) / 10000,
          output_cost: Math.round(((outputTokens / 1000000) * modelInfo.output_price_per_1m) * 10000) / 10000,
          pricing: {
            input_price_per_1m_tokens: modelInfo.input_price_per_1m,
            output_price_per_1m_tokens: modelInfo.output_price_per_1m,
          },
        };
        
        result.model_info = {
          provider: modelInfo.provider,
          context_length: modelInfo.context_length,
          capabilities: modelInfo.capabilities,
          max_tokens: modelInfo.max_tokens
        };
        
        return NextResponse.json(result);
      }
    } catch (error) {
      console.error('Error calling backend API:', error);
      return NextResponse.json(
        { error: 'Failed to communicate with backend API' },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('Error in /api/v1/chat/complete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}