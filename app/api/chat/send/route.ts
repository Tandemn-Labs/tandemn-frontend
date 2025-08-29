import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/mock/db';
import { chatSendSchema } from '@/lib/zod-schemas';
import { chargeCredits, getUserCredits } from '@/lib/credits';
import { sleep } from '@/lib/utils';
import { tandemnClient, mapModelToOpenRouter } from '@/lib/tandemn-client';
import { openRouterClient } from '@/lib/openrouter-client';
import { ChatResponseService } from '@/lib/services/chatResponseService';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const finalUserId = userId || 'anonymous';
    
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

    // Check user credits for authenticated users (1 credit per request)
    // Temporarily disabled for testing
    /*
    if (userId) {
      const userCredits = await getUserCredits(userId);
      const creditCost = 1;
      
      if (userCredits < creditCost) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits to continue.' },
          { status: 402 } // Payment Required
        );
      }
    }
    */
    
    // Calculate approximate token usage
    const userMessage = messages[messages.length - 1]?.content || '';
    const inputTokens = Math.ceil(userMessage.length / 4); // Rough estimate: 4 chars per token
    const startTime = Date.now();
    
    // Try to get real response from tandemn backend or OpenRouter fallback
    let response = '';
    let outputTokens = 0;
    let totalCost = 0;
    let backendUsed = 'mock';
    
        try {
      // Try tandemn backend first (now mocked with OpenRouter)
      const tandemnRequest = {
        model_name: model.id,
        input_text: userMessage,
        max_tokens: 150,
      };
      
      console.log('🔧 API: Trying tandemn backend with model:', model.id);
      const tandemnResponse = await tandemnClient.inferWithTimeout(tandemnRequest, 10000);
      
      if (tandemnResponse && tandemnResponse.result) {
        // Use the actual result from the mocked Tandemn backend
        response = tandemnResponse.result;
        outputTokens = Math.ceil(response.length / 4);
        backendUsed = 'tandemn';
        console.log('🔧 API: Setting backendUsed to tandemn (mocked with OpenRouter)');
      }
    } catch (tandemnError) {
      console.warn('🚨 TANDEMN BACKEND FAILED - FALLING BACK TO OPENROUTER');
      console.warn('Error details:', tandemnError);
      console.warn('Model attempted:', model.id);
      console.warn('User message:', userMessage);
      
      try {
        // Fallback to OpenRouter
        const openRouterModel = mapModelToOpenRouter(model.id);
        const openRouterRequest = {
          model: openRouterModel,
          messages: messages,
          max_tokens: 150,
        };
        
        console.log('🔄 FALLBACK: Using OpenRouter API with model:', model.id, '→', openRouterModel);
        const openRouterResponse = await openRouterClient.chatWithTimeout(openRouterRequest, 30000);
        
        if (openRouterResponse && openRouterResponse.choices?.[0]?.message?.content) {
          response = openRouterResponse.choices[0].message.content;
          outputTokens = openRouterResponse.usage?.completion_tokens || Math.ceil(response.length / 4);
          backendUsed = 'openrouter';
          console.log('✅ FALLBACK SUCCESS: OpenRouter response received');
          console.log('Response length:', response.length, 'characters');
          console.log('🔧 API: Setting backendUsed to:', backendUsed);
        }
      } catch (openRouterError) {
        console.error('❌ CRITICAL: Both tandemn and OpenRouter failed!');
        console.error('OpenRouter error:', openRouterError);
        console.error('Using mock response as final fallback');
        // Fallback to mock response
        const mockResponses = [
          `I'm ${model.name}, and I'm here to help! ${model.description}`,
          `Based on my training, I can assist you with various tasks. What would you like to know?`,
          `Hello! I'm running on ${model.vendor}'s infrastructure with ${model.context.toLocaleString()} tokens of context.`,
          `I understand you're looking for assistance. With my ${model.modalities.join(', ')} capabilities, I can help with many tasks.`,
          `Thank you for your message! As ${model.name}, I can provide detailed responses across multiple domains.`,
        ];
        response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
        backendUsed = 'mock';
        console.log('🔧 API: Setting backendUsed to mock');
      }
    }
    
    // Calculate tokens and cost
    outputTokens = outputTokens || Math.ceil(response.length / 4);
    const totalTokens = inputTokens + outputTokens;
    
    // Calculate cost based on model pricing
    const inputCost = (inputTokens / 1000000) * model.promptPrice;
    const outputCost = (outputTokens / 1000000) * model.completionPrice;
    totalCost = inputCost + outputCost;
    
    // Create assistant message for tracking (only if we have a roomId)
    let newMessage: any = null;
    if (roomId && userId) {
      newMessage = db.addMessage({
        roomId,
        role: 'assistant',
        content: response,
      });
    }

    // Save to database
    try {
      await ChatResponseService.createChatResponse({
        userId: finalUserId,
        modelId: model.id,
        roomId: roomId || undefined,
        messageId: newMessage?.id,
        inputText: userMessage,
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
      // Don't fail the request if database save fails
      // Log more details for debugging
      if (error instanceof Error) {
        console.error('❌ Database Error Details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
    }
    
    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        const words = response.split(' ');
        let currentIndex = 0;
        
        const sendChunk = async () => {
          if (currentIndex >= words.length) {
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
              
              // Charge 1 credit for chat usage
              await chargeCredits(1, `Chat: ${model.name}`, userId, { 
                modelId: model.id, 
                roomId, 
                inputTokens, 
                outputTokens 
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
          console.log('📤 API: Sending chunk with backend:', backendUsed);
          const chunk = `event: chunk\ndata: ${JSON.stringify(chunkData)}\n\n`;
          
          controller.enqueue(encoder.encode(chunk));
          currentIndex += wordsToSend;
          
          // Use model's latency to pace the response
          const delay = Math.max(50, model.latencyMs / words.length);
          await sleep(delay);
          sendChunk();
        };
        
        sendChunk();
      },
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

