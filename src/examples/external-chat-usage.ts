import { externalChatAPI, convertMessages } from '@/lib/external-chat-api';

// Example usage of the fallback chat API
// This will try Tandem first, then fallback to OpenRouter if needed

export async function basicChatExample() {
  try {
    // Note: This uses OpenRouter directly - for the fallback pattern, use the internal API route instead
    const request = externalChatAPI.createBasicRequest(
      'meta-llama/llama-3.3-70b-instruct',
      [
        { role: 'system', content: 'You are Llama-70B' },
        { role: 'user', content: 'Give me the python code for solving an ML Equation' }
      ],
      {
        temperature: 0.6,
        top_p: 0.9
      }
    );

    const response = await externalChatAPI.createChatCompletion(request);
    console.log('Response:', response.choices[0].message.content);
    return response;
    
  } catch (error) {
    console.error('Chat completion failed:', error);
    throw error;
  }
}

export async function streamingChatExample() {
  try {
    // Note: This uses OpenRouter directly - for the fallback pattern, use the internal API route instead
    const request = externalChatAPI.createBasicRequest(
      'meta-llama/llama-3.3-70b-instruct',
      [
        { role: 'system', content: 'You are Llama-70B' },
        { role: 'user', content: 'Explain machine learning in simple terms' }
      ],
      {
        stream: true,
        temperature: 0.6,
        top_p: 0.9
      }
    );

    await externalChatAPI.createStreamingChatCompletion(
      request,
      (chunk) => {
        // Handle each streaming chunk
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          process.stdout.write(content); // Stream to console
        }
      },
      (error) => {
        console.error('Streaming error:', error);
      }
    );
    
  } catch (error) {
    console.error('Streaming chat failed:', error);
    throw error;
  }
}

// *** RECOMMENDED: Use the fallback API route (tries Tandem first, then OpenRouter) ***

// Example usage with fallback API route - tries Tandem first, then OpenRouter
export async function useFallbackAPIRoute(apiKey: string) {
  try {
    const response = await fetch('/api/v1/external-chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct', // This will be used for both Tandem and OpenRouter
        stream: false,
        messages: [
          { role: 'system', content: 'You are Llama-70B' },
          { role: 'user', content: 'Give me the python code for solving an ML Equation' }
        ],
        temperature: 0.6,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Check which service was used
    console.log(`Response from: ${result.processing_source || 'unknown'}`);
    console.log(`Fallback used: ${result.fallback_used ? 'Yes' : 'No'}`);
    console.log('Response:', result.choices[0].message.content);
    
    return result;
    
  } catch (error) {
    console.error('Fallback API request failed:', error);
    throw error;
  }
}

// Example usage with streaming via fallback API route
export async function useFallbackStreamingRoute(apiKey: string) {
  try {
    const response = await fetch('/api/v1/external-chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        stream: true,
        messages: [
          { role: 'system', content: 'You are Llama-70B' },
          { role: 'user', content: 'Explain machine learning concepts' }
        ],
        temperature: 0.6,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';
    let processingSource = 'unknown';
    let fallbackUsed = false;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine === '' || !trimmedLine.startsWith('data: ')) continue;
        if (trimmedLine === 'data: [DONE]') {
          console.log(`\n\nStream completed. Source: ${processingSource}, Fallback used: ${fallbackUsed}`);
          return;
        }
        
        try {
          const jsonData = trimmedLine.slice(6);
          const chunk = JSON.parse(jsonData);
          
          if (chunk.error) {
            console.error('Stream error:', chunk.error);
            break;
          }
          
          // Track which service is being used
          if (chunk.processing_source) {
            processingSource = chunk.processing_source;
            fallbackUsed = chunk.fallback_used || false;
          }
          
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);
          }
        } catch (parseError) {
          console.warn('Failed to parse chunk:', trimmedLine);
        }
      }
    }
    
  } catch (error) {
    console.error('Fallback streaming API request failed:', error);
    throw error;
  }
}

// Example showing how to handle different response types
export async function demonstrateFallbackBehavior(apiKey: string) {
  console.log('=== Testing Fallback Behavior ===');
  
  try {
    const result = await useFallbackAPIRoute(apiKey);
    
    if (result.processing_source === 'tandem') {
      console.log('✅ Success: Tandem internal system handled the request');
    } else if (result.processing_source === 'openrouter') {
      console.log('🔄 Fallback: OpenRouter handled the request after Tandem failed');
    }
    
    console.log(`Credits charged: $${result.pricing?.credits_charged || 'unknown'}`);
    console.log(`Credits remaining: $${result.pricing?.credits_remaining || 'unknown'}`);
    
  } catch (error) {
    console.error('Both services failed:', error);
  }
}