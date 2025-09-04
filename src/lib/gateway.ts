import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from './redis';

export interface ModelInstance {
  id: string;
  modelId: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'busy' | 'offline';
  currentLoad: number;
  maxLoad: number;
  lastHealthCheck: string;
  responseTimeMs: number;
  totalRequests: number;
  errorCount: number;
  manuallyControlled: boolean; // Track if this instance was manually turned on/off
}

export interface QueuedRequest {
  id: string;
  modelId: string;
  payload: any;
  userId: string;
  priority: number;
  createdAt: string;
  timeout: number;
  retryCount: number;
  maxRetries: number;
}

export interface GatewayResponse {
  success: boolean;
  data?: any;
  error?: string;
  instanceId?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

export class APIGateway {
  private redis = getRedisClient();
  private instances: Map<string, ModelInstance> = new Map();
  
  // Define 5 model instances for different models
  private readonly DEFAULT_INSTANCES: Omit<ModelInstance, 'id'>[] = [
    {
      modelId: 'deepseek/deepseek-v3-0324-0',
      endpoint: 'http://localhost:8001/v1/chat',
      status: 'healthy',
      currentLoad: 0,
      maxLoad: 10,
      lastHealthCheck: new Date().toISOString(),
      responseTimeMs: 200,
      totalRequests: 0,
      errorCount: 0,
      manuallyControlled: false,
    },
    {
      modelId: 'qwen/qwen3-coder-0',
      endpoint: 'http://localhost:8002/v1/chat',
      status: 'healthy',
      currentLoad: 0,
      maxLoad: 8,
      lastHealthCheck: new Date().toISOString(),
      responseTimeMs: 250,
      totalRequests: 0,
      errorCount: 0,
      manuallyControlled: false,
    },
    {
      modelId: 'google/gemma-3-0',
      endpoint: 'http://localhost:8003/v1/chat',
      status: 'healthy',
      currentLoad: 0,
      maxLoad: 12,
      lastHealthCheck: new Date().toISOString(),
      responseTimeMs: 100,
      totalRequests: 0,
      errorCount: 0,
      manuallyControlled: false,
    },
    {
      modelId: 'microsoft/phi-4-0',
      endpoint: 'http://localhost:8004/v1/chat',
      status: 'healthy',
      currentLoad: 0,
      maxLoad: 6,
      lastHealthCheck: new Date().toISOString(),
      responseTimeMs: 300,
      totalRequests: 0,
      errorCount: 0,
      manuallyControlled: false,
    },
    {
      modelId: 'meta/llama-3-3-70b-0',
      endpoint: 'http://localhost:8005/v1/chat',
      status: 'healthy',
      currentLoad: 0,
      maxLoad: 15,
      lastHealthCheck: new Date().toISOString(),
      responseTimeMs: 50,
      totalRequests: 0,
      errorCount: 0,
      manuallyControlled: false,
    },
  ];

  constructor() {
    // Don't await here, but start initialization
    this.initializeInstances().catch(console.error);
    // TEMPORARILY DISABLE health checking to debug performance
    // this.startHealthChecking();
    console.log('Health checking disabled for debugging');
  }

  private async initializeInstances() {
    // ALWAYS clear existing instances first to prevent accumulation
    this.instances.clear();
    
    console.log('Creating fresh gateway instances (in-memory only)...');
    // Create exactly 5 new instances with unique IDs - NO REDIS for debugging
    for (const instanceData of this.DEFAULT_INSTANCES) {
      const instance: ModelInstance = {
        ...instanceData,
        id: uuidv4(),
      };
      this.instances.set(instance.id, instance);
      console.log(`Created fresh instance ${instance.id}: ${instance.modelId} (Machine ${this.getMachineNumber(instance.endpoint)})`);
    }
    
    console.log(`Gateway initialized with exactly ${this.instances.size} instances (in-memory only)`);
  }
  
  private getMachineNumber(endpoint: string): number {
    if (endpoint.includes('8001')) return 1;
    if (endpoint.includes('8002')) return 2;
    if (endpoint.includes('8003')) return 3;
    if (endpoint.includes('8004')) return 4;
    if (endpoint.includes('8005')) return 5;
    return 0;
  }

  // Get the best available instance for a model
  public async getBestInstance(modelId: string): Promise<ModelInstance | null> {
    // First try exact match
    let availableInstances = Array.from(this.instances.values())
      .filter(instance => 
        instance.modelId === modelId && 
        instance.status === 'healthy' && 
        instance.currentLoad < instance.maxLoad
      );

    // If no exact match, try to find compatible instances by vendor
    if (availableInstances.length === 0) {
      const vendor = modelId.split('/')[0];
      availableInstances = Array.from(this.instances.values())
        .filter(instance => 
          instance.modelId.startsWith(vendor) &&
          instance.status === 'healthy' && 
          instance.currentLoad < instance.maxLoad
        );
    }

    // If still no match, just get any healthy instance with capacity
    if (availableInstances.length === 0) {
      availableInstances = Array.from(this.instances.values())
        .filter(instance => 
          instance.status === 'healthy' && 
          instance.currentLoad < instance.maxLoad
        );
    }

    // Sort by load (ascending) and response time (ascending)
    availableInstances.sort((a, b) => {
      const loadDiff = a.currentLoad - b.currentLoad;
      if (loadDiff !== 0) return loadDiff;
      return a.responseTimeMs - b.responseTimeMs;
    });

    return availableInstances[0] || null;
  }

  // Queue a request for processing
  public async queueRequest(request: Omit<QueuedRequest, 'id' | 'createdAt'>): Promise<string> {
    const queuedRequest: QueuedRequest = {
      ...request,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    // Add to Redis queue
    const queueKey = `queue:${request.modelId}`;
    await this.redis.lpush(queueKey, JSON.stringify(queuedRequest));
    
    // Set expiration for the request
    await this.redis.expire(queueKey, request.timeout / 1000);
    
    return queuedRequest.id;
  }

  // Process next request in queue (DISABLED for direct execution mode)
  public async processNextRequest(modelId: string): Promise<QueuedRequest | null> {
    console.log('processNextRequest called but disabled for direct execution');
    return null; // Always return null to prevent blocking Redis operations
  }

  // Execute request on specific instance
  public async executeRequest(instanceId: string, request: QueuedRequest): Promise<GatewayResponse> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      console.log(`Instance ${instanceId} not found`);
      return { success: false, error: 'Instance not found' };
    }

    // Double-check instance status before processing
    if (instance.status !== 'healthy') {
      console.log(`Instance ${instanceId} is not healthy (status: ${instance.status}), rejecting request`);
      return { success: false, error: `Instance is ${instance.status}` };
    }

    if (instance.currentLoad >= instance.maxLoad) {
      console.log(`Instance ${instanceId} at capacity (${instance.currentLoad}/${instance.maxLoad})`);
      return { success: false, error: 'Instance at capacity' };
    }

    // Increment load
    instance.currentLoad++;
    await this.updateInstanceInRedis(instance);

    try {
      // Simulate API call to the model instance
      const startTime = Date.now();
      
      // For now, we'll use our existing mock logic
      // In production, this would make HTTP requests to actual model endpoints
      const response = await this.simulateModelCall(instance, request);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update instance stats
      instance.responseTimeMs = Math.round((instance.responseTimeMs + responseTime) / 2); // Rolling average
      instance.totalRequests++;
      instance.lastHealthCheck = new Date().toISOString();

      return {
        success: true,
        data: response,
        instanceId: instanceId,
      };

    } catch (error) {
      instance.errorCount++;
      console.error(`Request failed on instance ${instanceId}:`, error);
      
      return {
        success: false,
        error: 'Request processing failed',
        instanceId: instanceId,
      };
    } finally {
      // Decrement load
      instance.currentLoad = Math.max(0, instance.currentLoad - 1);
      await this.updateInstanceInRedis(instance);
    }
  }

  // Simulate model API call (replace with actual HTTP requests in production)
  private async simulateModelCall(instance: ModelInstance, request: QueuedRequest): Promise<any> {
    // Add minimal artificial latency for load testing (50-150ms)
    await new Promise(resolve => setTimeout(resolve, Math.min(instance.responseTimeMs / 10, 150)));

    // Get machine number from endpoint (8001 -> machine 1, 8002 -> machine 2, etc.)
    const machineNumber = instance.endpoint.includes('8001') ? 1 : 
                         instance.endpoint.includes('8002') ? 2 :
                         instance.endpoint.includes('8003') ? 3 :
                         instance.endpoint.includes('8004') ? 4 : 5;

    // Simple hello response with machine identification
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: instance.modelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Hello from Machine ${machineNumber}! (${instance.modelId})`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: request.payload.messages ? 
          Math.ceil(JSON.stringify(request.payload.messages).length / 4) : 10,
        completion_tokens: 8, // "Hello from Machine X!" is ~8 tokens
        total_tokens: 18,
      },
      instance_info: {
        id: instance.id,
        endpoint: instance.endpoint,
        machine_number: machineNumber,
        load: instance.currentLoad,
        response_time_ms: instance.responseTimeMs,
      },
    };
  }

  // Health check all instances
  public async performHealthChecks(): Promise<void> {
    for (const instance of this.instances.values()) {
      // Skip health checks for manually controlled instances
      if (instance.manuallyControlled) {
        console.log(`Skipping health check for manually controlled instance ${instance.id}`);
        continue;
      }

      try {
        // Simulate health check (in production, ping the actual endpoints)
        const isHealthy = Math.random() > 0.1; // 90% uptime simulation
        
        instance.status = isHealthy ? 'healthy' : 'unhealthy';
        instance.lastHealthCheck = new Date().toISOString();
        
        await this.updateInstanceInRedis(instance);
      } catch (error) {
        instance.status = 'offline';
        console.error(`Health check failed for instance ${instance.id}:`, error);
        await this.updateInstanceInRedis(instance);
      }
    }
  }

  private async updateInstanceInRedis(instance: ModelInstance): Promise<void> {
    // TEMPORARILY DISABLE Redis writes to debug performance
    try {
      // Don't wait for Redis operations that might be slow
      this.redis.hset(
        'gateway:instances',
        instance.id,
        JSON.stringify(instance)
      ).catch(err => console.log('Redis write error (ignored):', err));
    } catch (error) {
      console.log('Redis write error (ignored):', error);
    }
  }

  private startHealthChecking(): void {
    // Perform health checks every 30 seconds
    setInterval(() => {
      this.performHealthChecks().catch(console.error);
    }, 30000);
  }

  // Get queue status for a model
  public async getQueueStatus(modelId: string): Promise<{ length: number; estimatedWaitTime: number }> {
    const queueKey = `queue:${modelId}`;
    const length = await this.redis.llen(queueKey);
    
    // Estimate wait time based on average response time of healthy instances
    const healthyInstances = Array.from(this.instances.values())
      .filter(i => i.modelId === modelId && i.status === 'healthy');
    
    const avgResponseTime = healthyInstances.length > 0 
      ? healthyInstances.reduce((sum, i) => sum + i.responseTimeMs, 0) / healthyInstances.length
      : 2000; // Default 2s

    const estimatedWaitTime = length * avgResponseTime;

    return { length, estimatedWaitTime };
  }

  // Get all instances status
  public getInstancesStatus(): ModelInstance[] {
    return Array.from(this.instances.values());
  }

  // Get instance by model ID
  public getInstancesByModel(modelId: string): ModelInstance[] {
    return Array.from(this.instances.values()).filter(i => i.modelId === modelId);
  }

  // Start a machine (set status to healthy)
  public async startMachine(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      console.log(`Cannot start machine ${instanceId} - not found`);
      return false;
    }

    const oldStatus = instance.status;
    instance.status = 'healthy';
    instance.manuallyControlled = true; // Mark as manually controlled
    instance.lastHealthCheck = new Date().toISOString();
    await this.updateInstanceInRedis(instance);
    
    console.log(`Machine ${instanceId} manually started (${oldStatus} -> healthy) - Model: ${instance.modelId}`);
    return true;
  }

  // Stop a machine (set status to offline)
  public async stopMachine(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      console.log(`Cannot stop machine ${instanceId} - not found`);
      return false;
    }

    const oldStatus = instance.status;
    instance.status = 'offline';
    instance.manuallyControlled = true; // Mark as manually controlled
    instance.currentLoad = 0; // Clear any current load
    instance.lastHealthCheck = new Date().toISOString();
    await this.updateInstanceInRedis(instance);
    
    console.log(`Machine ${instanceId} manually stopped (${oldStatus} -> offline) - Model: ${instance.modelId}`);
    return true;
  }

  // Reset manual control for all instances (allow health checks to take over)
  public async resetManualControl(): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance.manuallyControlled) {
        instance.manuallyControlled = false;
        await this.updateInstanceInRedis(instance);
        console.log(`Reset manual control for instance ${instance.id}: ${instance.modelId}`);
      }
    }
  }
}

// Singleton instance with global persistence in development
declare global {
  var __gateway_instance: APIGateway | undefined;
}

let gatewayInstance: APIGateway | null = global.__gateway_instance || null;

export function getAPIGateway(): APIGateway {
  if (!gatewayInstance) {
    console.log('Creating single gateway instance...');
    gatewayInstance = new APIGateway();
    // Persist in global to survive hot reloads in development
    global.__gateway_instance = gatewayInstance;
  }
  return gatewayInstance;
}