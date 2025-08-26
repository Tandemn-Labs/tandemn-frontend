import { NextRequest, NextResponse } from 'next/server';
import { getAPIGateway } from '@/lib/gateway';
import { checkRedisHealth } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const gateway = getAPIGateway();
    
    // Perform health checks
    const redisHealthy = await checkRedisHealth();
    await gateway.performHealthChecks();
    
    const instances = gateway.getInstancesStatus();
    const healthyInstances = instances.filter(i => i.status === 'healthy');
    
    const isHealthy = redisHealthy && healthyInstances.length > 0;

    return NextResponse.json({
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      checks: {
        redis: redisHealthy,
        instances: {
          total: instances.length,
          healthy: healthyInstances.length,
          details: instances.map(i => ({
            id: i.id.substring(0, 8),
            modelId: i.modelId,
            status: i.status,
            load: `${i.currentLoad}/${i.maxLoad}`,
            lastCheck: i.lastHealthCheck,
          })),
        },
      },
    }, {
      status: isHealthy ? 200 : 503
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      healthy: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    }, {
      status: 503
    });
  }
}