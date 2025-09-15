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
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
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
    
    // Get all users
    const allUsers = await clerkClient.users.getUserList({ limit: 100 });
    
    const userStats: any[] = [];
    const dailyStats: Record<string, { date: string; totalTokens: number; totalUsers: number; totalRequests: number }> = {};
    
    // Process each user's transaction history
    for (const user of allUsers.data) {
      const transactions = (user.privateMetadata?.transactions as any[]) || [];
      const usageTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.createdAt);
        return t.type === 'usage_charge' && 
               transactionDate >= startDate && 
               transactionDate <= endDate;
      });
      
      if (usageTransactions.length > 0) {
        const totalInputTokens = usageTransactions.reduce((sum, t) => 
          sum + (t.metadata?.inputTokens || 0), 0
        );
        
        const totalOutputTokens = usageTransactions.reduce((sum, t) => 
          sum + (t.metadata?.outputTokens || 0), 0
        );
        
        const totalTokens = totalInputTokens + totalOutputTokens;
        
        const totalCost = usageTransactions.reduce((sum, t) => 
          sum + Math.abs(t.amount), 0
        );
        
        // Calculate model breakdown
        const modelUsage = usageTransactions.reduce((acc, t) => {
          const modelId = t.metadata?.modelId || 'unknown';
          if (!acc[modelId]) {
            acc[modelId] = { 
              inputTokens: 0, 
              outputTokens: 0, 
              totalTokens: 0, 
              requests: 0, 
              cost: 0 
            };
          }
          acc[modelId].inputTokens += (t.metadata?.inputTokens || 0);
          acc[modelId].outputTokens += (t.metadata?.outputTokens || 0);
          acc[modelId].totalTokens += (t.metadata?.inputTokens || 0) + (t.metadata?.outputTokens || 0);
          acc[modelId].requests += 1;
          acc[modelId].cost += Math.abs(t.amount);
          return acc;
        }, {});
        
        userStats.push({
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress || 'unknown',
          firstName: user.firstName,
          lastName: user.lastName,
          totalInputTokens,
          totalOutputTokens,
          totalTokens,
          totalCost,
          requestCount: usageTransactions.length,
          modelUsage,
          lastActivity: Math.max(...usageTransactions.map(t => new Date(t.createdAt).getTime()))
        });
        
        // Aggregate daily stats (in EST timezone)
        usageTransactions.forEach(t => {
          const transactionDate = new Date(t.createdAt);
          // Convert to EST and get date string
          const date = transactionDate.toLocaleDateString('en-CA', {
            timeZone: 'America/New_York'
          }); // ISO format YYYY-MM-DD in EST
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
          totalInputTokens: 0,
          totalOutputTokens: 0,
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
        const hasActivityOnDate = transactions.some(t => {
          const transactionDate = new Date(t.createdAt);
          // Convert to EST date string for comparison
          const estDate = transactionDate.toLocaleDateString('en-CA', {
            timeZone: 'America/New_York'
          });
          return t.type === 'usage_charge' && 
                 estDate === date &&
                 transactionDate >= startDate && 
                 transactionDate <= endDate;
        });
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
        period: startDateParam && endDateParam ? 
          `${startDateParam} to ${endDateParam}` : 
          `${days} days`
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