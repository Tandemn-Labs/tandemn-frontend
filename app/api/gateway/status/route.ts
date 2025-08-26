import { NextRequest, NextResponse } from 'next/server';
import { getAPIGateway } from '@/lib/gateway';
import { getQueueProcessor } from '@/lib/queue-processor';
import { checkRedisHealth } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const gateway = getAPIGateway();
    const processor = getQueueProcessor();

    // Get system health
    const redisHealthy = await checkRedisHealth();
    const instances = gateway.getInstancesStatus();
    const queueStats = await processor.getQueueStats();

    // Calculate overall health metrics
    const totalInstances = instances.length;
    const healthyInstances = instances.filter(i => i.status === 'healthy').length;
    const totalLoad = instances.reduce((sum, i) => sum + i.currentLoad, 0);
    const totalCapacity = instances.reduce((sum, i) => sum + i.maxLoad, 0);

    const systemStatus = {
      status: redisHealthy && healthyInstances > 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      redis: {
        healthy: redisHealthy,
        status: redisHealthy ? 'connected' : 'disconnected',
      },
      instances: {
        total: totalInstances,
        healthy: healthyInstances,
        unhealthy: totalInstances - healthyInstances,
        load: `${totalLoad}/${totalCapacity}`,
        utilization: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
      },
      queues: queueStats,
      performance: {
        averageResponseTime: instances.length > 0 
          ? Math.round(instances.reduce((sum, i) => sum + i.responseTimeMs, 0) / instances.length)
          : 0,
        totalRequests: instances.reduce((sum, i) => sum + i.totalRequests, 0),
        totalErrors: instances.reduce((sum, i) => sum + i.errorCount, 0),
      },
    };

    return NextResponse.json(systemStatus);
  } catch (error) {
    console.error('Error getting gateway status:', error);
    return NextResponse.json(
      { error: 'Failed to get gateway status' },
      { status: 500 }
    );
  }
}