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
    // Mock health response
    console.log('🤖 MOCK TANDEMN: Returning mock health response');
    
    return {
      status: 'success',
      machines: [
        {
          machine_id: 'mock-machine-1',
          metrics: {
            cpu_percent: 45,
            ram_percent: 62,
            total_free_vram_gb: 12.5,
            gpu_count: 2,
            gpu_info: [
              {
                name: 'NVIDIA RTX 4090',
                memory_total: 24576,
                memory_free: 12500,
                utilization: 35,
              },
              {
                name: 'NVIDIA RTX 4090',
                memory_total: 24576,
                memory_free: 11800,
                utilization: 42,
              },
            ],
          },
          timestamp: new Date().toISOString(),
        },
        {
          machine_id: 'mock-machine-2',
          metrics: {
            cpu_percent: 38,
            ram_percent: 55,
            total_free_vram_gb: 18.2,
            gpu_count: 1,
            gpu_info: [
              {
                name: 'NVIDIA RTX 4080',
                memory_total: 16384,
                memory_free: 18200,
                utilization: 28,
              },
            ],
          },
          timestamp: new Date().toISOString(),
        },
      ],
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

  async inferWithTimeout(
    request: TandemnInferenceRequest, 
    timeoutMs: number = 10000
  ): Promise<TandemnInferenceResponse> {
    // Mock Tandemn backend using OpenRouter
    console.log('🤖 MOCK TANDEMN: Using OpenRouter as backend for model:', request.model_name);
    
    try {
      // Map Tandemn model to OpenRouter model
      const openRouterModel = mapModelToOpenRouter(request.model_name);
      
      // Create OpenRouter request
      const openRouterRequest = {
        model: openRouterModel,
        messages: [
          {
            role: 'user' as const,
            content: request.input_text,
          },
        ],
        max_tokens: request.max_tokens,
      };

      console.log('🤖 MOCK TANDEMN: Calling OpenRouter with model:', openRouterModel);
      
      // Call OpenRouter
      const openRouterResponse = await openRouterClient.chatWithTimeout(openRouterRequest, timeoutMs);
      
      if (!openRouterResponse || !openRouterResponse.choices?.[0]?.message?.content) {
        throw new Error('OpenRouter returned invalid response');
      }

      const result = openRouterResponse.choices[0].message.content;
      const requestId = `tandemn-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log('🤖 MOCK TANDEMN: Successfully got response from OpenRouter, returning as Tandemn response');

      // Return response in Tandemn format
      return {
        request_id: requestId,
        status: 'completed',
        result: result,
        processing_time: 1500, // Mock processing time
      };
    } catch (error) {
      console.error('🤖 MOCK TANDEMN: Error calling OpenRouter:', error);
      throw new Error(`Mock Tandemn inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
