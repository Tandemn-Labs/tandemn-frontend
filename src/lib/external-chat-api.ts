export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  stream: boolean;
  messages: ChatCompletionMessage[];
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  min_tokens?: number;
  seed?: number;
  frequency_penalty?: number;
  repetition_penalty?: number;
  presence_penalty?: number;
  n?: number;
  eos_token_id?: number[];
  stop?: string[];
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | 'content_filter';
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamingChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason?: 'stop' | 'length' | 'content_filter';
  }>;
}

const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';

export class ExternalChatAPI {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = OPENROUTER_API_BASE_URL, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
    }

    return response.json();
  }

  async createStreamingChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamingChatCompletionChunk) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
      onError?.(error);
      throw error;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    try {
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine === '') continue;
          if (trimmedLine === 'data: [DONE]') return;
          if (!trimmedLine.startsWith('data: ')) continue;
          
          try {
            const jsonData = trimmedLine.slice(6); // Remove 'data: ' prefix
            const chunk = JSON.parse(jsonData) as StreamingChatCompletionChunk;
            onChunk(chunk);
          } catch (parseError) {
            console.warn('Failed to parse SSE chunk:', trimmedLine, parseError);
          }
        }
      }
    } catch (error) {
      onError?.(error as Error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  // Convenience method to create a basic chat request
  createBasicRequest(
    model: string,
    messages: ChatCompletionMessage[],
    options: Partial<Omit<ChatCompletionRequest, 'model' | 'messages'>> = {}
  ): ChatCompletionRequest {
    return {
      model,
      messages,
      stream: false,
      temperature: 0.6,
      top_p: 0.9,
      ...options,
    };
  }
}

// Default instance - will be initialized with OpenRouter API key from environment
export const externalChatAPI = new ExternalChatAPI(
  OPENROUTER_API_BASE_URL, 
  process.env.OPENROUTER_API_KEY
);

// Helper function to convert internal message format to external format
export function convertMessages(messages: Array<{ role: string; content: string }>): ChatCompletionMessage[] {
  return messages.map(msg => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }));
}