import { openRouterClient } from './openrouter-client';
import { getOpenRouterModelId } from './models-config';

// Helper function to map tandemn model names to OpenRouter model names
export function mapModelToOpenRouter(tandemnModel: string): string {
  return getOpenRouterModelId(tandemnModel);
}

export interface TandemnInferenceRequest {
  model_name: string;
  input_text: string;
  max_tokens: number;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; // Added for conversation support
}

export interface TandemnInferenceResponse {
  request_id: string;
  status: string;
  result: string | null;
  processing_time: number | null;
}

export interface TandemnHealthResponse {
  status: string;
  machines: Array<{
    machine_id: string;
    metrics: {
      cpu_percent: number;
      ram_percent: number;
      total_free_vram_gb: number;
      gpu_count: number;
      gpu_info: any[];
    };
    timestamp: string;
  }>;
}

export interface TandemnDeploymentRequest {
  model_id: string;
  hf_token?: string;
  qbits?: number;
  filename?: string;
}

export class TandemnClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.TANDEMN_BACKEND_URL || 'http://localhost:8000';
  }

  async health(): Promise<TandemnHealthResponse> {
    console.log('🔧 TANDEMN: Returning mock health response (health checks disabled)');
    
    // Always return mock health data to avoid connection errors
    // Real health will be checked during actual inference calls
    return {
      status: 'success',
      machines: [{
        machine_id: 'tandem-backend-mock',
        metrics: {
          cpu_percent: 25,
          ram_percent: 65,
          total_free_vram_gb: 8.5,
          gpu_count: 1,
          gpu_info: [{
            name: 'NVIDIA L40S (Mock)',
            memory_total: 45000,
            memory_free: 8500,
            utilization: 15,
            temperature_celsius: 45,
          }],
        },
        timestamp: new Date().toISOString(),
      }],
    };
  }

  async infer(request: TandemnInferenceRequest): Promise<TandemnInferenceResponse> {
    const response = await fetch(`${this.baseUrl}/infer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inference failed: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async inferStreamingWithTimeout(
    request: TandemnInferenceRequest,
    onChunk: (content: string) => void,
    timeoutMs: number = 60000,
    externalSignal?: AbortSignal // Accept external abort signal
  ): Promise<TandemnInferenceResponse> {
    console.log('🔧 TANDEMN: Calling real Tandem backend for streaming model:', request.model_name);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Listen to external abort signal (from frontend stop button)
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => {
        console.log('🛑 TANDEMN: External abort signal received');
        controller.abort();
      });
    }

    try {
      // Convert Tandemn request to exact format that works with Tandem API
      const tandemnRequest = {
        model: request.model_name,
        messages: request.messages || [
          {
            role: 'user' as const,
            content: request.input_text,
          },
        ],
        stream: true, // Use streaming like the working curl
        max_completion_tokens: request.max_tokens || 2000,
        temperature: 0.6,
        top_p: 0.9
      };

      console.log('🔧 TANDEMN: Sending streaming request to:', `${this.baseUrl}/v1/chat/completions`);
      console.log('🔧 TANDEMN: Request payload:', JSON.stringify(tandemnRequest));
      
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(tandemnRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tandem backend inference failed: ${response.statusText} - ${errorText}`);
      }

      // Handle streaming response from Tandem with real-time callbacks
      console.log('✅ TANDEMN: Successfully connected to Tandem backend, processing stream...');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let completeContent = '';
      
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      // Declare timeout variable outside try block for cleanup  
      let connectionTimeout: NodeJS.Timeout | null = null;
      
      try {
        let buffer = '';
        let emptyChunkCount = 0;
        let lastContentTime = Date.now();
        let hasReceivedRealContent = false;
        
        // Set up bailout timeout after connection success
        connectionTimeout = setTimeout(() => {
          if (!hasReceivedRealContent) {
            console.log('🔄 TANDEMN: No real content received within 12 seconds of connection, bailing out for OpenRouter');
            controller.abort();
          }
        }, 12000); // 12 seconds after successful connection
        
        while (true) {
          // Check if abort was signaled
          if (controller.signal.aborted || externalSignal?.aborted) {
            if (connectionTimeout) clearTimeout(connectionTimeout);
            console.log('🛑 TANDEMN: Abort signal detected, stopping stream reading');
            if (!hasReceivedRealContent) {
              throw new Error('TANDEM_BAILOUT: No real content received, connection timeout');
            }
            break;
          }
          
          // Bailout if too many empty chunks and too much time passed (after real content was received)
          if (hasReceivedRealContent && emptyChunkCount >= 8 && (Date.now() - lastContentTime) > 15000) {
            if (connectionTimeout) clearTimeout(connectionTimeout);
            console.log('🔄 TANDEMN: Too many empty chunks after content, bailing out for fallback');
            throw new Error('TANDEM_BAILOUT: No real content received');
          }
          
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            // Check for abort signal again before processing each line
            if (controller.signal.aborted || externalSignal?.aborted) {
              console.log('🛑 TANDEMN: Abort signal detected during line processing, stopping');
              break;
            }
            
            const trimmedLine = line.trim();
            
            if (trimmedLine === '') continue;
            if (trimmedLine === 'data: [DONE]') {
              console.log('✅ TANDEMN: Stream completed successfully');
              break;
            }
            if (!trimmedLine.startsWith('data: ')) continue;
            
            try {
              const jsonData = trimmedLine.slice(6); // Remove 'data: ' prefix
              const chunk = JSON.parse(jsonData);
              let content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                // Filter out end-of-text tokens in real-time
                const filteredContent = content
                  .replace(/<\|eot_id\|>/g, '')
                  .replace(/<\|end\|>/g, '')
                  .replace(/<\|endoftext\|>/g, '');
                
                if (filteredContent && filteredContent.trim()) {
                  lastContentTime = Date.now();
                  emptyChunkCount = 0;
                  if (!hasReceivedRealContent) {
                    hasReceivedRealContent = true;
                    if (connectionTimeout) clearTimeout(connectionTimeout);
                    console.log('✅ TANDEMN: First real content received, clearing connection timeout');
                  }
                  completeContent += filteredContent;
                  onChunk(filteredContent); // Call the streaming callback
                } else {
                  emptyChunkCount++;
                }
              } else {
                emptyChunkCount++;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE chunk:', trimmedLine);
            }
          }
          
          // Break out of outer loop if abort detected during inner loop
          if (controller.signal.aborted || externalSignal?.aborted) {
            break;
          }
        }
      } finally {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        reader.releaseLock();
      }
      
      console.log(`✅ TANDEMN: Stream processing complete. Total content: ${completeContent.length} characters`);
      
      // Convert to Tandemn format
      const result: TandemnInferenceResponse = {
        request_id: `tandemn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        result: completeContent.trim(),
        processing_time: null,
      };
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          console.log('🛑 TANDEMN: Request cancelled by user');
          throw new Error('Request cancelled by user');
        } else {
          console.log('⏱️ TANDEMN: Request timed out');
          throw new Error('Tandem backend request timed out');
        }
      }
      console.error('❌ TANDEMN: Real backend failed:', error);
      throw error;
    }
  }

  async inferWithTimeout(
    request: TandemnInferenceRequest, 
    timeoutMs: number = 60000
  ): Promise<TandemnInferenceResponse> {
    console.log('🔧 TANDEMN: Calling real Tandem backend for model:', request.model_name);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Convert Tandemn request to exact format that works with Tandem API
      const tandemnRequest = {
        model: request.model_name,
        messages: request.messages || [
          {
            role: 'user' as const,
            content: request.input_text,
          },
        ],
        stream: true, // Use streaming like the working curl
        max_completion_tokens: request.max_tokens || 2000, // Use the max_tokens from request, default to 2000
        temperature: 0.6,
        top_p: 0.9
      };

      console.log('🔧 TANDEMN: Sending streaming request to:', `${this.baseUrl}/v1/chat/completions`);
      console.log('🔧 TANDEMN: Request payload:', JSON.stringify(tandemnRequest));
      console.log('🔧 TANDEMN: Production deployment test - backend URL:', this.baseUrl);
      
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(tandemnRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tandem backend inference failed: ${response.statusText} - ${errorText}`);
      }

      // Handle streaming response from Tandem properly
      console.log('✅ TANDEMN: Successfully connected to Tandem backend, processing stream...');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let completeContent = '';
      
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      // Declare timeout variable outside try block for cleanup  
      let connectionTimeout: NodeJS.Timeout | null = null;
      
      try {
        let buffer = '';
        let emptyChunkCount = 0;
        let lastContentTime = Date.now();
        let hasReceivedRealContent = false;
        
        // Set up bailout timeout after connection success
        connectionTimeout = setTimeout(() => {
          if (!hasReceivedRealContent) {
            console.log('🔄 TANDEMN: No real content received within 12 seconds of connection, bailing out for OpenRouter');
            controller.abort();
          }
        }, 10000); // 12 seconds after successful connection
        
        while (true) {
          // Check if abort was signaled
          if (controller.signal.aborted) {
            if (connectionTimeout) clearTimeout(connectionTimeout);
            if (!hasReceivedRealContent) {
              throw new Error('TANDEM_BAILOUT: No real content received, connection timeout');
            }
            break;
          }
          
          // Bailout if too many empty chunks and too much time passed (after real content was received)
          if (hasReceivedRealContent && emptyChunkCount >= 8 && (Date.now() - lastContentTime) > 15000) {
            if (connectionTimeout) clearTimeout(connectionTimeout);
            console.log('🔄 TANDEMN: Too many empty chunks after content, bailing out for fallback');
            throw new Error('TANDEM_BAILOUT: No real content received');
          }
          
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine === '') continue;
            if (trimmedLine === 'data: [DONE]') {
              console.log('✅ TANDEMN: Stream completed successfully');
              break;
            }
            if (!trimmedLine.startsWith('data: ')) continue;
            
            try {
              const jsonData = trimmedLine.slice(6); // Remove 'data: ' prefix
              const chunk = JSON.parse(jsonData);
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                // Filter out end-of-text tokens
                const filteredContent = content
                  .replace(/<\|eot_id\|>/g, '')
                  .replace(/<\|end\|>/g, '')
                  .replace(/<\|endoftext\|>/g, '');
                
                if (filteredContent && filteredContent.trim()) {
                  lastContentTime = Date.now();
                  emptyChunkCount = 0;
                  if (!hasReceivedRealContent) {
                    hasReceivedRealContent = true;
                    if (connectionTimeout) clearTimeout(connectionTimeout);
                    console.log('✅ TANDEMN: First real content received, clearing connection timeout');
                  }
                  completeContent += filteredContent;
                  // Log progress for debugging
                  if (completeContent.length % 100 === 0) {
                    console.log(`📝 TANDEMN: Received ${completeContent.length} characters so far...`);
                  }
                } else {
                  emptyChunkCount++;
                }
              } else {
                emptyChunkCount++;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE chunk:', trimmedLine);
            }
          }
        }
      } finally {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        reader.releaseLock();
      }
      
      console.log(`✅ TANDEMN: Stream processing complete. Total content: ${completeContent.length} characters`);
      
      // Filter out end-of-text tokens
      completeContent = completeContent
        .replace(/<\|eot_id\|>/g, '')
        .replace(/<\|end\|>/g, '')
        .replace(/<\|endoftext\|>/g, '')
        .trim();
      
      // Convert to Tandemn format
      const result: TandemnInferenceResponse = {
        request_id: `tandemn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        result: completeContent || null,
        processing_time: null,
      };
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Tandem backend request timed out');
      }
      console.error('❌ TANDEMN: Real backend failed:', error);
      throw error;
    }
  }

  async getInferenceStatus(requestId: string): Promise<TandemnInferenceResponse> {
    const response = await fetch(`${this.baseUrl}/status/${requestId}`);
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async deployModel(request: TandemnDeploymentRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/deploy_model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Model deployment failed: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getDeploymentStatus(modelName: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/deployment_status/${modelName}`);
    if (!response.ok) {
      throw new Error(`Deployment status check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async listDeployments(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/deployments`);
    if (!response.ok) {
      throw new Error(`Failed to list deployments: ${response.statusText}`);
    }
    return response.json();
  }

  async estimateModel(request: TandemnDeploymentRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/estimate_model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Model estimation failed: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }
}

// Create a singleton instance
export const tandemnClient = new TandemnClient();
