import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTransactionHistory } from '@/lib/credits';
import { sleep } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    await sleep(100);
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // Get transaction history from Clerk metadata
    const transactions = await getTransactionHistory(userId);
    
    // Filter transactions for the specified period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.createdAt) >= cutoffDate && t.type === 'usage_charge'
    );
    
    // Calculate usage stats
    const totalTokens = recentTransactions.reduce((sum, t) => 
      sum + ((t.metadata?.inputTokens || 0) + (t.metadata?.outputTokens || 0)), 0
    );
    
    const totalCost = recentTransactions.reduce((sum, t) => 
      sum + Math.abs(t.amount), 0
    );
    
    // Group usage by model
    const modelUsage = recentTransactions.reduce((acc, t) => {
      const modelId = t.metadata?.modelId || 'unknown';
      if (!acc[modelId]) {
        acc[modelId] = {
          modelId,
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0,
        };
      }
      
      acc[modelId].totalTokens += (t.metadata?.inputTokens || 0) + (t.metadata?.outputTokens || 0);
      acc[modelId].totalCost += Math.abs(t.amount);
      acc[modelId].requestCount += 1;
      
      return acc;
    }, {} as Record<string, any>);
    
    return NextResponse.json({
      usage: {
        totalTokens,
        totalCost,
        period: `${days} days`,
        requestCount: recentTransactions.length,
      },
      models: Object.values(modelUsage),
      transactions: recentTransactions.slice(0, 20), // Latest 20 for timeline
    });
  } catch (error) {
    console.error('Error in /api/credits/usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}