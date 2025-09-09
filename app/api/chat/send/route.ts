import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/mock/db';
import { chatSendSchema } from '@/lib/zod-schemas';
import { chargeCredits, getUserCredits, calculateTokenCost } from '@/lib/credits';
import { sleep } from '@/lib/utils';
import { tandemnClient, mapModelToOpenRouter } from '@/lib/tandemn-client';
import { openRouterClient } from '@/lib/openrouter-client';
import { ChatResponseService } from '@/lib/services/chatResponseService';
import { ConversationService } from '@/lib/services/conversationService';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { modelId, roomId, messages } = chatSendSchema.parse(body);
    
    // Get the model to determine latency
    const model = db.getModelById(modelId);
    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    // Calculate conversation text for token estimation
    const conversationText = messages.map(m => m.content).join(' ');
    
    // Check user credits for authenticated users (based on model pricing)
    const estimatedInputTokens = Math.ceil(conversationText.length / 4);
    const estimatedOutputTokens = Math.ceil(2000 / 4); // Assume max tokens for estimation
    const estimatedCost = calculateTokenCost(model.id, estimatedInputTokens, estimatedOutputTokens);
    
    if (userId) {
      const userCredits = await getUserCredits(userId);
      
      if (userCredits < estimatedCost) {
        return NextResponse.json(
          { 
            error: `Insufficient credits. You need $${estimatedCost.toFixed(2)} but only have $${userCredits.toFixed(2)}. Please purchase more credits to continue.`,
            requiredCredits: estimatedCost,
            currentCredits: userCredits
          },
          { status: 402 } // Payment Required
        );
      }
    }
    
    // Store the user message in MongoDB with encryption
    if (roomId) {
      const userMessage = messages[messages.length - 1];
      if (userMessage && userMessage.role === 'user') {
        try {
          await ConversationService.addMessage(
            roomId,
            userId,
            'user',
            userMessage.content
          );
          console.log('💾 MongoDB: Saved user message with encryption');
        } catch (error) {
          console.error('❌ MongoDB: Failed to save user message:', error);
          // Don't fail the request if user message save fails - continue with response
        }
      }
    }

    // Calculate approximate token usage for the entire conversation  
    const inputTokens = Math.ceil(conversationText.length / 4); // Rough estimate: 4 chars per token
    const startTime = Date.now();
    
    // Create a ReadableStream for real-time SSE streaming
    const encoder = new TextEncoder();
    let response = '';
    let outputTokens = 0;
    let totalCost = 0;
    let backendUsed = 'mock';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Try tandemn backend first with real-time streaming
          const tandemnRequest = {
            model_name: model.id,
            input_text: conversationText,
            max_tokens: 2000,
            messages: messages, // Pass full conversation history
          };
          
          console.log('🔧 API: Trying tandemn backend with streaming for model:', model.id);
          
          const tandemnResponse = await tandemnClient.inferStreamingWithTimeout(
            tandemnRequest, 
            (content: string) => {
              // Real-time streaming callback - send content immediately
              response += content;
              const chunkData = { 
                text: content, 
                done: false,
                backend: 'tandemn'
              };
              console.log('📤 API: Streaming chunk from tandem:', content.slice(0, 50) + '...');
              const chunk = `event: chunk\ndata: ${JSON.stringify(chunkData)}\n\n`;
              controller.enqueue(encoder.encode(chunk));
            },
            60000 // 60 second timeout
          );
          
          if (tandemnResponse && tandemnResponse.result) {
            // Use the actual result from the real Tandemn backend
            outputTokens = Math.ceil(response.length / 4);
            backendUsed = 'tandemn';
            console.log('🔧 API: Setting backendUsed to tandemn (real backend)');
            
            // Calculate tokens and cost
            const totalTokens = inputTokens + outputTokens;
            
            // Calculate cost based on model pricing
            const inputCost = (inputTokens / 1000000) * model.promptPrice;
            const outputCost = (outputTokens / 1000000) * model.completionPrice;
            totalCost = inputCost + outputCost;
            
            // Store assistant message in MongoDB with encryption
            let newMessage: any = null;
            if (roomId) {
              try {
                const assistantMessage = await ConversationService.addMessage(
                  roomId,
                  userId,
                  'assistant',
                  response,
                  model.id,
                  {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    cost: totalCost,
                  },
                  {
                    backend: backendUsed as 'tandemn' | 'openrouter' | 'mock',
                    processingTime: Date.now() - startTime,
                  }
                );
                newMessage = { id: assistantMessage.id };
                console.log('💾 MongoDB: Saved assistant message with encryption');
              } catch (error) {
                console.error('❌ MongoDB: Failed to save assistant message:', error);
                // Continue without failing the request
              }
            }

            // Save to database
            try {
              await ChatResponseService.createChatResponse({
                userId: userId,
                modelId: model.id,
                roomId: roomId || undefined,
                messageId: newMessage?.id,
                inputText: conversationText,
                responseText: response,
                backendUsed: backendUsed as 'tandemn' | 'openrouter' | 'mock',
                inputTokens,
                outputTokens,
                totalTokens,
                inputCost,
                outputCost,
                totalCost,
                processingTimeMs: Date.now() - startTime,
                metadata: {
                  modelVendor: model.vendor,
                  modelName: model.name,
                  requestId: newMessage?.id,
                },
              });
              console.log('💾 Database: Saved chat response to MongoDB');
            } catch (error) {
              console.error('❌ Database: Failed to save chat response:', error);
            }
            
            // Track usage if user is authenticated
            if (userId) {
              const trackingUserId = userId === 'demo' ? 'demo-user' : userId;
              
              // Record usage in database
              db.addUsage({
                userId: trackingUserId,
                modelId: model.id,
                roomId: roomId || undefined,
                messageId: newMessage?.id,
                inputTokens,
                outputTokens,
                totalTokens,
                cost: totalCost,
              });
              
              // Charge credits based on actual token usage and model pricing
              const actualCost = calculateTokenCost(model.id, inputTokens, outputTokens);
              await chargeCredits(actualCost, `${model.name}: ${inputTokens} input + ${outputTokens} output tokens`, userId, { 
                modelId: model.id, 
                roomId, 
                inputTokens, 
                outputTokens,
                backend: backendUsed,
                cost: actualCost
              });
            }
            
            // Send final chunk
            const finalChunkData = { 
              done: true,
              backend: backendUsed
            };
            console.log('📤 API: Sending final chunk with backend:', backendUsed);
            const finalChunk = `event: chunk\ndata: ${JSON.stringify(finalChunkData)}\n\n`;
            controller.enqueue(encoder.encode(finalChunk));
            controller.close();
            return;
          }
        } catch (tandemnError) {
          console.error('❌ TANDEMN BACKEND FAILED');
          console.error('Error details:', tandemnError);
          console.error('Model attempted:', model.id);
          console.error('Conversation length:', messages.length, 'messages');
          
          // Fallback to OpenRouter when Tandem backend fails
          console.log('🔀 API: Falling back to OpenRouter due to Tandem failure');
          try {
            const openRouterModel = mapModelToOpenRouter(model.id);
            console.log('🔀 API: Using OpenRouter model:', openRouterModel);
            
            const openRouterRequest = {
              model: openRouterModel,
              messages: messages,
              max_tokens: 2000,
              temperature: 0.7,
            };
            
            const openRouterResponse = await openRouterClient.chatWithTimeout(openRouterRequest, 30000);
            
            if (openRouterResponse && openRouterResponse.choices && openRouterResponse.choices[0]) {
              response = openRouterResponse.choices[0].message.content || '';
              outputTokens = openRouterResponse.usage?.completion_tokens || Math.ceil(response.length / 4);
              backendUsed = 'openrouter';
              console.log('✅ API: OpenRouter fallback successful');
              
              // Send the OpenRouter response as streaming chunks (simulated)
              const words = response.split(' ');
              let currentIndex = 0;
              
              const sendFallbackChunk = async () => {
                if (currentIndex >= words.length) {
                  // Send final chunk for OpenRouter fallback
                  const finalChunkData = { 
                    done: true,
                    backend: backendUsed
                  };
                  console.log('📤 API: Sending final fallback chunk with backend:', backendUsed);
                  const finalChunk = `event: chunk\ndata: ${JSON.stringify(finalChunkData)}\n\n`;
                  controller.enqueue(encoder.encode(finalChunk));
                  controller.close();
                  return;
                }
                
                // Send word(s) - sometimes multiple words at once for variety
                const wordsToSend = Math.random() > 0.7 ? 2 : 1;
                const textChunk = words
                  .slice(currentIndex, currentIndex + wordsToSend)
                  .join(' ') + (currentIndex + wordsToSend < words.length ? ' ' : '');
                
                const chunkData = { 
                  text: textChunk, 
                  done: false,
                  backend: backendUsed
                };
                console.log('📤 API: Sending fallback chunk with backend:', backendUsed);
                const chunk = `event: chunk\ndata: ${JSON.stringify(chunkData)}\n\n`;
                
                controller.enqueue(encoder.encode(chunk));
                currentIndex += wordsToSend;
                
                // Use model's latency to pace the response
                const delay = Math.max(50, model.latencyMs / words.length);
                setTimeout(sendFallbackChunk, delay);
              };
              
              sendFallbackChunk();
              return;
              
            } else {
              throw new Error('OpenRouter returned empty response');
            }
          } catch (openRouterError) {
            console.error('❌ API: Both Tandem and OpenRouter failed');
            console.error('Tandem error:', tandemnError);
            console.error('OpenRouter error:', openRouterError);
            
            // Send error through the stream
            const errorChunk = `event: chunk\ndata: ${JSON.stringify({ 
              error: `Both Tandem and OpenRouter backends failed. Tandem: ${tandemnError instanceof Error ? tandemnError.message : 'Unknown error'}. OpenRouter: ${openRouterError instanceof Error ? openRouterError.message : 'Unknown error'}`,
              backends_attempted: ['tandemn', 'openrouter'],
              tandem_endpoint: `${process.env.TANDEMN_BACKEND_URL}/v1/chat/completions`,
              done: true
            })}\n\n`;
            controller.enqueue(encoder.encode(errorChunk));
            controller.close();
            return;
          }
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Error in /api/chat/send:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

