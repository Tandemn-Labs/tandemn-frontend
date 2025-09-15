import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // Get all users
    const allUsers = await clerkClient.users.getUserList({ limit: 100 });
    
    const userStats: any[] = [];
    const dailyStats: Record<string, { date: string; totalTokens: number; totalUsers: number; totalRequests: number }> = {};
    
    // Process each user's transaction history
    for (const user of allUsers.data) {
      const transactions = (user.privateMetadata?.transactions as any[]) || [];
      const usageTransactions = transactions.filter(t => 
        t.type === 'usage_charge' && 
        new Date(t.createdAt) >= new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      
      if (usageTransactions.length > 0) {
        const totalTokens = usageTransactions.reduce((sum, t) => 
          sum + ((t.metadata?.inputTokens || 0) + (t.metadata?.outputTokens || 0)), 0
        );
        
        const totalCost = usageTransactions.reduce((sum, t) => 
          sum + Math.abs(t.amount), 0
        );
        
        // Calculate model breakdown
        const modelUsage = usageTransactions.reduce((acc, t) => {
          const modelId = t.metadata?.modelId || 'unknown';
          if (!acc[modelId]) {
            acc[modelId] = { tokens: 0, requests: 0, cost: 0 };
          }
          acc[modelId].tokens += (t.metadata?.inputTokens || 0) + (t.metadata?.outputTokens || 0);
          acc[modelId].requests += 1;
          acc[modelId].cost += Math.abs(t.amount);
          return acc;
        }, {});
        
        userStats.push({
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress || 'unknown',
          firstName: user.firstName,
          lastName: user.lastName,
          totalTokens,
          totalCost,
          requestCount: usageTransactions.length,
          modelUsage,
          lastActivity: Math.max(...usageTransactions.map(t => new Date(t.createdAt).getTime()))
        });
        
        // Aggregate daily stats
        usageTransactions.forEach(t => {
          const date = new Date(t.createdAt).toISOString().split('T')[0];
          if (!dailyStats[date]) {
            dailyStats[date] = { date, totalTokens: 0, totalUsers: 0, totalRequests: 0 };
          }
          dailyStats[date].totalTokens += (t.metadata?.inputTokens || 0) + (t.metadata?.outputTokens || 0);
          dailyStats[date].totalRequests += 1;
        });
      } else {
        // Include users with no recent activity
        userStats.push({
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress || 'unknown',
          firstName: user.firstName,
          lastName: user.lastName,
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0,
          modelUsage: {},
          lastActivity: null
        });
      }
    }
    
    // Calculate unique users per day
    Object.keys(dailyStats).forEach(date => {
      const usersOnDate = new Set();
      allUsers.data.forEach(user => {
        const transactions = (user.privateMetadata?.transactions as any[]) || [];
        const hasActivityOnDate = transactions.some(t => 
          t.type === 'usage_charge' && 
          new Date(t.createdAt).toISOString().split('T')[0] === date
        );
        if (hasActivityOnDate) {
          usersOnDate.add(user.id);
        }
      });
      dailyStats[date].totalUsers = usersOnDate.size;
    });
    
    // Sort user stats by total tokens (descending)
    userStats.sort((a, b) => b.totalTokens - a.totalTokens);
    
    // Sort daily stats by date
    const sortedDailyStats = Object.values(dailyStats).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate overall totals
    const totalTokensProcessed = userStats.reduce((sum, user) => sum + user.totalTokens, 0);
    const totalActiveUsers = userStats.filter(user => user.totalTokens > 0).length;
    const totalRequests = userStats.reduce((sum, user) => sum + user.requestCount, 0);
    const totalCost = userStats.reduce((sum, user) => sum + user.totalCost, 0);
    
    return NextResponse.json({
      summary: {
        totalUsers: allUsers.data.length,
        activeUsers: totalActiveUsers,
        totalTokensProcessed,
        totalRequests,
        totalCost,
        period: `${days} days`
      },
      userStats,
      dailyStats: sortedDailyStats,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
});