import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/mock/db';
import { chatSendSchema } from '@/lib/zod-schemas';
import { sleep } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
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
    
    // Calculate approximate token usage
    const userMessage = messages[messages.length - 1]?.content || '';
    const inputTokens = Math.ceil(userMessage.length / 4); // Rough estimate: 4 chars per token
    
    // Create a simple mock response based on the model
    const mockResponses = [
      `I'm ${model.name}, and I'm here to help! ${model.description}`,
      `Based on my training, I can assist you with various tasks. What would you like to know?`,
      `Hello! I'm running on ${model.vendor}'s infrastructure with ${model.context.toLocaleString()} tokens of context.`,
      `I understand you're looking for assistance. With my ${model.modalities.join(', ')} capabilities, I can help with many tasks.`,
      `Thank you for your message! As ${model.name}, I can provide detailed responses across multiple domains.`,
    ];
    
    const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    const outputTokens = Math.ceil(response.length / 4);
    const totalTokens = inputTokens + outputTokens;
    
    // Calculate cost based on model pricing
    const inputCost = (inputTokens / 1000000) * model.promptPrice;
    const outputCost = (outputTokens / 1000000) * model.completionPrice;
    const totalCost = inputCost + outputCost;
    
    // Create assistant message for tracking (only if we have a roomId)
    let newMessage: any = null;
    if (roomId && session?.user?.id) {
      newMessage = db.addMessage({
        roomId,
        role: 'assistant',
        content: response,
      });
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
            if (session?.user?.id) {
              const trackingUserId = session.user.id === 'demo' ? 'demo-user' : session.user.id;
              
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
              
              // Deduct credits from user balance
              db.addTransaction({
                userId: trackingUserId,
                type: 'usage',
                amount: -totalCost,
                description: `Used ${model.name} - ${totalTokens} tokens`,
                modelId: model.id,
                tokens: totalTokens,
                metadata: {
                  roomId: roomId || undefined,
                  messageId: newMessage?.id,
                },
              });
            }
            
            // Send final chunk
            const finalChunk = `event: chunk\ndata: ${JSON.stringify({ done: true })}\n\n`;
            controller.enqueue(encoder.encode(finalChunk));
            controller.close();
            return;
          }
          
          // Send word(s) - sometimes multiple words at once for variety
          const wordsToSend = Math.random() > 0.7 ? 2 : 1;
          const textChunk = words
            .slice(currentIndex, currentIndex + wordsToSend)
            .join(' ') + (currentIndex + wordsToSend < words.length ? ' ' : '');
          
          const chunk = `event: chunk\ndata: ${JSON.stringify({ 
            text: textChunk, 
            done: false 
          })}\n\n`;
          
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
