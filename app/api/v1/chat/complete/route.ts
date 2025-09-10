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
      // Note: These vLLM backends always return streaming responses regardless of stream parameter
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      };

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
        // Handle non-streaming response by collecting all streaming chunks
        // Since the backend always returns streaming, we need to convert it
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          return NextResponse.json(
            { error: 'Failed to get response stream' },
            { status: 500 }
          );
        }

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let fullContent = '';
        let responseId = '';
        let responseCreated = 0;

        try {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue;
              if (!trimmedLine.startsWith('data: ')) continue;
              
              try {
                const jsonData = trimmedLine.slice(6);
                const chunk = JSON.parse(jsonData);
                
                // Store response metadata
                if (chunk.id) responseId = chunk.id;
                if (chunk.created) responseCreated = chunk.created;
                
                // Extract token usage from chunk if available
                if (chunk.usage) {
                  totalInputTokens = chunk.usage.prompt_tokens || totalInputTokens;
                  totalOutputTokens = chunk.usage.completion_tokens || totalOutputTokens;
                }
                
                // Accumulate content
                if (chunk.choices?.[0]?.delta?.content) {
                  fullContent += chunk.choices[0].delta.content;
                }
              } catch (parseError) {
                // Ignore parse errors
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Estimate tokens if not provided by backend
        if (totalInputTokens === 0) totalInputTokens = estimatedInputTokens;
        if (totalOutputTokens === 0) totalOutputTokens = Math.ceil(fullContent.length / 4);
        
        const totalTokens = totalInputTokens + totalOutputTokens;
        
        // Calculate actual cost
        const actualCost = calculateCost(model, totalInputTokens, totalOutputTokens);
        
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
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            total_tokens: totalTokens
          }
        });
        
        // Return OpenAI-compatible non-streaming response
        const result = {
          id: responseId || `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: responseCreated || Math.floor(Date.now() / 1000),
          model: model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: fullContent,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: totalInputTokens,
            completion_tokens: totalOutputTokens,
            total_tokens: totalTokens,
          },
          // Tandemn-specific billing info
          billing: {
            credits_charged: actualCost,
            credits_remaining: userBalance - actualCost,
            input_cost: Math.round(((totalInputTokens / 1000000) * modelInfo.input_price_per_1m) * 10000) / 10000,
            output_cost: Math.round(((totalOutputTokens / 1000000) * modelInfo.output_price_per_1m) * 10000) / 10000,
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