import { NextRequest, NextResponse } from 'next/server';
import { tandemnClient } from '@/lib/tandemn-client';
import { openRouterClient } from '@/lib/openrouter-client';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { model, messages, max_tokens = 150 } = body;

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: model and messages array' },
        { status: 400 }
      );
    }

    // Convert the chat format to tandemn format
    const lastMessage = messages[messages.length - 1];
    const inputText = lastMessage.content;

    // Start inference with tandemn backend
    const inferenceRequest = {
      model_name: model,
      input_text: inputText,
      max_tokens: max_tokens,
    };

    console.log('Starting tandemn inference:', inferenceRequest);

    let tandemnResponse: any = null;
    let tandemnError: string | null = null;

    // Try tandemn backend first with timeout
    try {
      tandemnResponse = await tandemnClient.inferWithTimeout(inferenceRequest, 10000); // 10 second timeout
      console.log('Tandemn inference started:', tandemnResponse);
    } catch (error) {
      tandemnError = error instanceof Error ? error.message : 'Unknown tandemn error';
      console.warn('Tandemn inference failed, falling back to OpenRouter:', tandemnError);
    }

    // If tandemn failed or timed out, try OpenRouter
    if (!tandemnResponse) {
      try {
        console.log('Falling back to OpenRouter API...');
        
        // Map tandemn model names to OpenRouter model names if needed
        const openRouterModel = mapModelToOpenRouter(model);
        
        const openRouterRequest = {
          model: openRouterModel,
          messages: messages,
          max_tokens: max_tokens,
        };

        const openRouterResponse = await openRouterClient.chatWithTimeout(openRouterRequest, 30000);
        console.log('OpenRouter response received');

        return NextResponse.json({
          ...openRouterResponse,
          _fallback: 'openrouter', // Flag to indicate this was a fallback
        });

      } catch (openRouterError) {
        console.error('Both tandemn and OpenRouter failed:', { tandemnError, openRouterError });
        return NextResponse.json(
          { 
            error: `All inference methods failed. Tandemn: ${tandemnError}. OpenRouter: ${openRouterError instanceof Error ? openRouterError.message : 'Unknown error'}` 
          },
          { status: 500 }
        );
      }
    }

    // If tandemn succeeded, return the response (you'll need to implement polling for actual results)
    return NextResponse.json({
      id: tandemnResponse.request_id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Inference started with request ID: ${tandemnResponse.request_id}. This is a placeholder response - you'll need to implement polling for the actual result.`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      _fallback: 'tandemn', // Flag to indicate this was tandemn
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: `Chat API failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Helper function to map tandemn model names to OpenRouter model names
function mapModelToOpenRouter(tandemnModel: string): string {
  // Add mappings as needed - for now, return the same name
  const modelMappings: Record<string, string> = {
    // Example mappings:
    // 'llama-3.1-70b': 'meta/llama-3.1-70b',
    // 'gemma-2b': 'google/gemma-2b',
  };

  return modelMappings[tandemnModel] || tandemnModel;
}
