import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/mock/db';
import { sleep } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    await sleep(100);
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const userId = session.user.id === 'demo' ? 'demo-user' : session.user.id;
    
    // Get usage statistics
    const stats = db.getUserUsageStats(userId, days);
    
    // Get detailed usage records
    const usageRecords = db.getUserUsage(userId, limit);
    
    // Enhance usage records with model information
    const enhancedUsage = usageRecords.map(usage => {
      const model = db.getModelById(usage.modelId);
      return {
        ...usage,
        modelName: model?.name || 'Unknown Model',
        modelVendor: model?.vendor || 'Unknown',
        modelSeries: model?.series || 'Other',
      };
    });
    
    // Format model breakdown for easier consumption
    const modelBreakdown = Object.entries(stats.modelBreakdown).map(([modelId, data]) => {
      const model = db.getModelById(modelId);
      return {
        modelId,
        modelName: model?.name || 'Unknown Model',
        modelVendor: model?.vendor || 'Unknown',
        ...data,
      };
    }).sort((a, b) => b.cost - a.cost); // Sort by cost descending
    
    return NextResponse.json({
      stats: {
        totalTokens: stats.totalTokens,
        totalCost: stats.totalCost,
        period: `${days} days`,
      },
      modelBreakdown,
      recentUsage: enhancedUsage,
    });
  } catch (error) {
    console.error('Error in /api/credits/usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
