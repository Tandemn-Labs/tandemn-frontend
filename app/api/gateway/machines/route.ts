import { NextRequest, NextResponse } from 'next/server';
import { getSimpleGateway } from '@/lib/simple-gateway';

export async function GET() {
  try {
    const gateway = getSimpleGateway();
    const machines = gateway.getMachines();
    
    return NextResponse.json({
      machines: machines.map(machine => ({
        id: machine.id,
        machineNumber: machine.machineNumber,
        modelId: machine.modelId,
        status: machine.status,
        load: `0/10`, // Simplified for demo
        responseTime: `${50 + Math.random() * 100}ms`,
        endpoint: machine.endpoint,
        totalRequests: Math.floor(Math.random() * 100),
        errorCount: 0,
        lastHealthCheck: new Date().toISOString()
      }))
    });
  } catch (error) {
    console.error('Error getting machines:', error);
    return NextResponse.json(
      { error: 'Failed to get machines' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { machineId, action } = await request.json();
    
    if (!machineId || !action) {
      return NextResponse.json(
        { error: 'Missing machineId or action' },
        { status: 400 }
      );
    }

    const gateway = getSimpleGateway();
    const success = gateway.toggleMachine(machineId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Machine not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, machineId, action });
  } catch (error) {
    console.error('Error controlling machine:', error);
    return NextResponse.json(
      { error: 'Failed to control machine' },
      { status: 500 }
    );
  }
}

function getMachineNumber(endpoint: string): number {
  if (endpoint.includes('8001')) return 1;
  if (endpoint.includes('8002')) return 2;
  if (endpoint.includes('8003')) return 3;
  if (endpoint.includes('8004')) return 4;
  if (endpoint.includes('8005')) return 5;
  return 0;
}