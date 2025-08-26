import { getAPIGateway, QueuedRequest, GatewayResponse } from './gateway';
import { getRedisClient } from './redis';

export class QueueProcessor {
  private gateway = getAPIGateway();
  private redis = getRedisClient();
  private processing: Map<string, boolean> = new Map(); // Track processing state per model
  private readonly PROCESSING_INTERVAL = 100; // Check queue every 100ms
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  // Start processing queues for specific models
  public startProcessing(modelIds: string[]): void {
    for (const modelId of modelIds) {
      if (!this.processing.get(modelId)) {
        this.processing.set(modelId, true);
        this.startModelProcessor(modelId);
      }
    }
  }

  // Stop processing queues for specific models
  public stopProcessing(modelIds: string[]): void {
    for (const modelId of modelIds) {
      this.processing.set(modelId, false);
      const interval = this.intervals.get(modelId);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(modelId);
      }
    }
  }

  // Start processing queue for a specific model
  private startModelProcessor(modelId: string): void {
    const interval = setInterval(async () => {
      if (!this.processing.get(modelId)) {
        return;
      }

      try {
        await this.processModelQueue(modelId);
      } catch (error) {
        console.error(`Error processing queue for ${modelId}:`, error);
      }
    }, this.PROCESSING_INTERVAL);

    this.intervals.set(modelId, interval);
  }

  // Process pending requests for a model
  private async processModelQueue(modelId: string): Promise<void> {
    // Get next request from queue first
    const request = await this.gateway.processNextRequest(modelId);
    if (!request) {
      // No pending requests
      return;
    }

    // Check if request has expired
    const requestAge = Date.now() - new Date(request.createdAt).getTime();
    if (requestAge > request.timeout) {
      console.log(`Request ${request.id} expired, age: ${requestAge}ms`);
      await this.storeResult(request.id, {
        success: false,
        error: 'Request timeout',
      });
      return;
    }

    // Get available instance RIGHT BEFORE processing (to account for real-time status changes)
    const instance = await this.gateway.getBestInstance(modelId);
    if (!instance) {
      console.log(`No healthy instances available for model ${modelId}, requeueing request ${request.id}`);
      // Requeue the request with a small delay
      setTimeout(async () => {
        await this.gateway.queueRequest(request);
      }, 1000);
      return;
    }

    console.log(`Processing request ${request.id} on instance ${instance.id} (status: ${instance.status})`);

    // Process the request
    const result = await this.gateway.executeRequest(instance.id, request);
    
    // Store result for client retrieval
    await this.storeResult(request.id, result);

    // If request failed and has retries left, requeue it
    if (!result.success && request.retryCount < request.maxRetries) {
      const retryRequest: QueuedRequest = {
        ...request,
        retryCount: request.retryCount + 1,
      };
      
      // Add small delay before retry
      setTimeout(async () => {
        await this.gateway.queueRequest(retryRequest);
      }, 1000 * request.retryCount); // Exponential backoff
    }
  }

  // Store processing result in Redis for client retrieval
  private async storeResult(requestId: string, result: GatewayResponse): Promise<void> {
    const resultKey = `result:${requestId}`;
    await this.redis.setex(resultKey, 300, JSON.stringify(result)); // Store for 5 minutes
  }

  // Get processing result
  public async getResult(requestId: string): Promise<GatewayResponse | null> {
    const resultKey = `result:${requestId}`;
    const resultData = await this.redis.get(resultKey);
    
    if (!resultData) return null;
    
    try {
      return JSON.parse(resultData);
    } catch (error) {
      console.error('Failed to parse result:', error);
      return null;
    }
  }

  // Wait for result with polling
  public async waitForResult(requestId: string, timeoutMs: number = 30000): Promise<GatewayResponse> {
    const startTime = Date.now();
    const pollInterval = 500; // Poll every 500ms

    return new Promise((resolve) => {
      const poll = async () => {
        const result = await this.getResult(requestId);
        
        if (result) {
          resolve(result);
          return;
        }

        // Check timeout
        if (Date.now() - startTime >= timeoutMs) {
          resolve({
            success: false,
            error: 'Request processing timeout',
          });
          return;
        }

        // Continue polling
        setTimeout(poll, pollInterval);
      };

      poll();
    });
  }

  // Get queue statistics
  public async getQueueStats(): Promise<Record<string, any>> {
    // Get actual model IDs from gateway instances
    const instances = this.gateway.getInstancesStatus();
    const modelIds = [...new Set(instances.map(i => i.modelId))];
    const stats: Record<string, any> = {};

    for (const modelId of modelIds) {
      const queueStatus = await this.gateway.getQueueStatus(modelId);
      const instances = this.gateway.getInstancesByModel(modelId);
      
      stats[modelId] = {
        queue: queueStatus,
        instances: instances.map(i => ({
          id: i.id,
          status: i.status,
          load: `${i.currentLoad}/${i.maxLoad}`,
          responseTime: `${i.responseTimeMs}ms`,
          requests: i.totalRequests,
          errors: i.errorCount,
        })),
      };
    }

    return stats;
  }
}

// Singleton instance
let processorInstance: QueueProcessor | null = null;

export function getQueueProcessor(): QueueProcessor {
  if (!processorInstance) {
    processorInstance = new QueueProcessor();
    
    // DISABLE auto-start for load testing - we use direct execution
    console.log('Queue processor created but not auto-started (direct execution mode)');
  }
  return processorInstance;
}