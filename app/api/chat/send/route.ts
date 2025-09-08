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
    
    // Try to get real response from tandemn backend or OpenRouter fallback
    let response = '';
    let outputTokens = 0;
    let totalCost = 0;
    let backendUsed = 'mock';
    
        try {
      // Try tandemn backend first (now mocked with OpenRouter)
      const tandemnRequest = {
        model_name: model.id,
        input_text: conversationText,
        max_tokens: 2000,
        messages: messages, // Pass full conversation history
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
      console.warn('Conversation length:', messages.length, 'messages');
      
      try {
        // Fallback to OpenRouter
        const openRouterModel = mapModelToOpenRouter(model.id);
        const openRouterRequest = {
          model: openRouterModel,
          messages: messages,
          max_tokens: 2000,
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
        // Fallback to mock response with conversation awareness
        const latestUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
        const mockResponses = [
          `I'm ${model.name}, and I understand you mentioned: "${latestUserMessage.substring(0, 50)}${latestUserMessage.length > 50 ? '...' : ''}". Let me help with that.`,
          `Based on our conversation so far (${messages.length} messages), I can assist you further. What specific aspect would you like me to focus on?`,
          `Hello! I'm ${model.name} with ${model.context.toLocaleString()} tokens of context. I see we've been discussing various topics - how can I help you next?`,
          `Thank you for continuing our conversation! As ${model.name}, I can provide contextual responses based on what we've discussed.`,
          `I appreciate the ongoing dialogue. With ${messages.length} messages exchanged, I'm building a good understanding of what you need.`,
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

