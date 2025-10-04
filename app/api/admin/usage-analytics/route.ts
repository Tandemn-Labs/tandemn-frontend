import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface UserUsageDetail {
  userId: string;
  userName: string;
  userEmail: string;
  currentCredits: number;
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalMoneySpent: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  modelsUsed: string[];
  lastApiCall: string;
  firstApiCall: string;
  usageByModel: Array<{
    modelId: string;
    apiCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    moneySpent: number;
    avgCostPerCall: number;
  }>;
  dailyUsage: Array<{
    date: string;
    apiCalls: number;
    tokens: number;
    cost: number;
  }>;
}

interface UsageStats {
  totalUsers: number;
  activeUsers: number;
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalRevenue: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  avgTokensPerUser: number;
  topSpenders: Array<{
    userName: string;
    userEmail: string;
    totalSpent: number;
    apiCalls: number;
  }>;
  topModels: Array<{
    modelId: string;
    apiCalls: number;
    totalTokens: number;
    revenue: number;
  }>;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const usersResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = usersResponse.data;

    const userUsageDetails: UserUsageDetail[] = [];
    let totalApiCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalRevenue = 0;
    let activeUsers = 0;

    const modelStats = new Map<string, { apiCalls: number; totalTokens: number; revenue: number }>();

    for (const user of users) {
      const credits = (user.privateMetadata?.credits as number) || 0;
      const transactions = (user.privateMetadata?.transactions as any[]) || [];
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name';
      const userEmail = user.emailAddresses[0]?.emailAddress || 'No email';

      let userApiCalls = 0;
      let userInputTokens = 0;
      let userOutputTokens = 0;
      let userTotalTokens = 0;
      let userMoneySpent = 0;
      const userModels = new Set<string>();
      let lastApiCall = '';
      let firstApiCall = '';
      
      const modelUsageMap = new Map<string, {
        apiCalls: number;
        inputTokens: number;
        outputTokens: number;
        moneySpent: number;
      }>();

      const dailyUsageMap = new Map<string, { apiCalls: number; tokens: number; cost: number }>();

      // Analyze transactions for usage data
      for (const transaction of transactions) {
        if (transaction.type === 'usage_charge' && transaction.metadata) {
          const metadata = transaction.metadata;
          
          // API call count
          if (metadata.modelId || metadata.inputTokens || metadata.outputTokens) {
            userApiCalls++;
            totalApiCalls++;

            // Track first and last API calls
            if (!firstApiCall || new Date(transaction.createdAt) < new Date(firstApiCall)) {
              firstApiCall = transaction.createdAt;
            }
            if (!lastApiCall || new Date(transaction.createdAt) > new Date(lastApiCall)) {
              lastApiCall = transaction.createdAt;
            }
          }

          // Token tracking
          const inputTokens = metadata.inputTokens || 0;
          const outputTokens = metadata.outputTokens || 0;
          const tokens = inputTokens + outputTokens;
          
          userInputTokens += inputTokens;
          userOutputTokens += outputTokens;
          userTotalTokens += tokens;
          
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;

          // Money spent (usage charges are negative)
          const cost = Math.abs(transaction.amount);
          userMoneySpent += cost;
          totalRevenue += cost;

          // Model tracking
          if (metadata.modelId) {
            userModels.add(metadata.modelId);
            
            // Per-model usage
            const existing = modelUsageMap.get(metadata.modelId) || {
              apiCalls: 0,
              inputTokens: 0,
              outputTokens: 0,
              moneySpent: 0,
            };
            
            existing.apiCalls += 1;
            existing.inputTokens += inputTokens;
            existing.outputTokens += outputTokens;
            existing.moneySpent += cost;
            
            modelUsageMap.set(metadata.modelId, existing);

            // Global model stats
            const globalModel = modelStats.get(metadata.modelId) || {
              apiCalls: 0,
              totalTokens: 0,
              revenue: 0,
            };
            
            globalModel.apiCalls += 1;
            globalModel.totalTokens += tokens;
            globalModel.revenue += cost;
            
            modelStats.set(metadata.modelId, globalModel);
          }

          // Daily usage tracking
          const date = new Date(transaction.createdAt).toISOString().split('T')[0];
          const dailyUsage = dailyUsageMap.get(date) || { apiCalls: 0, tokens: 0, cost: 0 };
          dailyUsage.apiCalls += 1;
          dailyUsage.tokens += tokens;
          dailyUsage.cost += cost;
          dailyUsageMap.set(date, dailyUsage);
        }
      }

      // Calculate averages
      const avgCostPerCall = userApiCalls > 0 ? userMoneySpent / userApiCalls : 0;
      const avgTokensPerCall = userApiCalls > 0 ? userTotalTokens / userApiCalls : 0;

      // Convert model usage map to array
      const usageByModel = Array.from(modelUsageMap.entries()).map(([modelId, usage]) => ({
        modelId,
        apiCalls: usage.apiCalls,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
        moneySpent: usage.moneySpent,
        avgCostPerCall: usage.apiCalls > 0 ? usage.moneySpent / usage.apiCalls : 0,
      })).sort((a, b) => b.moneySpent - a.moneySpent);

      // Convert daily usage map to array
      const dailyUsage = Array.from(dailyUsageMap.entries())
        .map(([date, usage]) => ({ date, ...usage }))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (userApiCalls > 0) {
        activeUsers++;
      }

      const userDetail: UserUsageDetail = {
        userId: user.id,
        userName,
        userEmail,
        currentCredits: credits,
        totalApiCalls: userApiCalls,
        totalInputTokens: userInputTokens,
        totalOutputTokens: userOutputTokens,
        totalTokens: userTotalTokens,
        totalMoneySpent: userMoneySpent,
        avgCostPerCall,
        avgTokensPerCall,
        modelsUsed: Array.from(userModels),
        lastApiCall,
        firstApiCall,
        usageByModel,
        dailyUsage,
      };

      userUsageDetails.push(userDetail);
    }

    // Calculate global averages
    const avgCostPerCall = totalApiCalls > 0 ? totalRevenue / totalApiCalls : 0;
    const avgTokensPerCall = totalApiCalls > 0 ? (totalInputTokens + totalOutputTokens) / totalApiCalls : 0;
    const avgTokensPerUser = users.length > 0 ? (totalInputTokens + totalOutputTokens) / users.length : 0;

    // Top spenders
    const topSpenders = userUsageDetails
      .filter(user => user.totalMoneySpent > 0)
      .sort((a, b) => b.totalMoneySpent - a.totalMoneySpent)
      .slice(0, 10)
      .map(user => ({
        userName: user.userName,
        userEmail: user.userEmail,
        totalSpent: user.totalMoneySpent,
        apiCalls: user.totalApiCalls,
      }));

    // Top models
    const topModels = Array.from(modelStats.entries())
      .map(([modelId, stats]) => ({
        modelId,
        apiCalls: stats.apiCalls,
        totalTokens: stats.totalTokens,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

    const stats: UsageStats = {
      totalUsers: users.length,
      activeUsers,
      totalApiCalls,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalRevenue,
      avgCostPerCall,
      avgTokensPerCall,
      avgTokensPerUser,
      topSpenders,
      topModels,
    };

    // Sort users by total money spent (highest first)
    userUsageDetails.sort((a, b) => b.totalMoneySpent - a.totalMoneySpent);

    return NextResponse.json({
      users: userUsageDetails,
      stats,
    });
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage analytics' },
      { status: 500 }
    );
  }
});