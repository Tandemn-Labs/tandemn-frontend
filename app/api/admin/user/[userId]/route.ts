import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  // Check admin permission
  const adminStatus = await isAdmin();
  if (!adminStatus) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }), 
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const { userId } = await params;
    
    let startDate: Date;
    let endDate: Date;
    
    if (startDateParam && endDateParam) {
      // Custom date range
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Days-based range
      endDate = new Date();
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    // Get specific user
    const user = await clerkClient.users.getUser(userId);
    const transactions = (user.privateMetadata?.transactions as any[]) || [];
    
    // Filter transactions for the date range
    const usageTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.createdAt);
      return t.type === 'usage_charge' && 
             transactionDate >= startDate && 
             transactionDate <= endDate;
    });


    // Group transactions by date (in EST timezone)
    const dailyUsage: Record<string, {
      date: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      requests: number;
      cost: number;
      models: Record<string, { inputTokens: number; outputTokens: number; requests: number; cost: number }>;
    }> = {};

    usageTransactions.forEach(t => {
      const transactionDate = new Date(t.createdAt);
      // Convert to EST and get date string
      const date = transactionDate.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York'
      }); // ISO format YYYY-MM-DD in EST

      if (!dailyUsage[date]) {
        dailyUsage[date] = {
          date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          requests: 0,
          cost: 0,
          models: {}
        };
      }

      const inputTokens = t.metadata?.inputTokens || 0;
      const outputTokens = t.metadata?.outputTokens || 0;
      const modelId = t.metadata?.modelId || 'unknown';
      const cost = Math.abs(t.amount);

      dailyUsage[date].inputTokens += inputTokens;
      dailyUsage[date].outputTokens += outputTokens;
      dailyUsage[date].totalTokens += inputTokens + outputTokens;
      dailyUsage[date].requests += 1;
      dailyUsage[date].cost += cost;

      // Track per-model usage per day
      if (!dailyUsage[date].models[modelId]) {
        dailyUsage[date].models[modelId] = {
          inputTokens: 0,
          outputTokens: 0,
          requests: 0,
          cost: 0
        };
      }

      dailyUsage[date].models[modelId].inputTokens += inputTokens;
      dailyUsage[date].models[modelId].outputTokens += outputTokens;
      dailyUsage[date].models[modelId].requests += 1;
      dailyUsage[date].models[modelId].cost += cost;
    });

    return NextResponse.json({
      userId,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      dailyUsage,
      period: startDateParam && endDateParam ? 
        `${startDateParam} to ${endDateParam}` : 
        `${days} days`,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in user details API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}