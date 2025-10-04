import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface TransactionDetail {
  id: string;
  type: 'credit_purchase' | 'usage_charge' | 'bonus_credit' | 'refund';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageId?: string;
  metadata?: {
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
    addedByAdmin?: boolean;
    [key: string]: any;
  };
}

interface TransactionStats {
  totalTransactions: number;
  totalRevenue: number;
  totalCreditsUsed: number;
  totalCreditsIssued: number;
  avgTransactionValue: number;
  transactionsByType: {
    credit_purchase: number;
    usage_charge: number;
    bonus_credit: number;
    refund: number;
  };
  transactionsToday: number;
  transactionsThisWeek: number;
  topModels: Array<{
    modelId: string;
    usage: number;
    revenue: number;
  }>;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const usersResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = usersResponse.data;

    const allTransactions: TransactionDetail[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalRevenue = 0;
    let totalCreditsUsed = 0;
    let totalCreditsIssued = 0;
    let transactionsToday = 0;
    let transactionsThisWeek = 0;
    
    const transactionsByType = {
      credit_purchase: 0,
      usage_charge: 0,
      bonus_credit: 0,
      refund: 0,
    };

    const modelUsage = new Map<string, { usage: number; revenue: number }>();

    for (const user of users) {
      const transactions = (user.privateMetadata?.transactions as any[]) || [];
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name';
      const userEmail = user.emailAddresses[0]?.emailAddress || 'No email';

      for (const transaction of transactions) {
        const txDetail: TransactionDetail = {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          status: transaction.status,
          createdAt: transaction.createdAt,
          userId: user.id,
          userName,
          userEmail,
          packageId: transaction.packageId,
          metadata: transaction.metadata,
        };

        allTransactions.push(txDetail);

        // Update stats
        const createdAt = new Date(transaction.createdAt);
        if (createdAt >= todayStart) {
          transactionsToday++;
        }
        if (createdAt >= weekStart) {
          transactionsThisWeek++;
        }

        // Count by type
        if (transactionsByType.hasOwnProperty(transaction.type)) {
          transactionsByType[transaction.type as keyof typeof transactionsByType]++;
        }

        // Revenue and credit calculations
        if (transaction.type === 'credit_purchase' && transaction.amount > 0) {
          totalRevenue += transaction.amount;
          totalCreditsIssued += transaction.amount;
        } else if (transaction.type === 'bonus_credit' && transaction.amount > 0) {
          totalCreditsIssued += transaction.amount;
        } else if (transaction.type === 'usage_charge' && transaction.amount < 0) {
          totalCreditsUsed += Math.abs(transaction.amount);
        }

        // Model usage tracking
        if (transaction.metadata?.modelId) {
          const modelId = transaction.metadata.modelId;
          const existing = modelUsage.get(modelId) || { usage: 0, revenue: 0 };
          existing.usage += 1;
          if (transaction.amount < 0) { // Usage charge
            existing.revenue += Math.abs(transaction.amount);
          }
          modelUsage.set(modelId, existing);
        }
      }
    }

    // Calculate average transaction value
    const totalTransactionValue = allTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const avgTransactionValue = allTransactions.length > 0 ? totalTransactionValue / allTransactions.length : 0;

    // Top models by usage
    const topModels = Array.from(modelUsage.entries())
      .map(([modelId, stats]) => ({
        modelId,
        usage: stats.usage,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    const stats: TransactionStats = {
      totalTransactions: allTransactions.length,
      totalRevenue,
      totalCreditsUsed,
      totalCreditsIssued,
      avgTransactionValue,
      transactionsByType,
      transactionsToday,
      transactionsThisWeek,
      topModels,
    };

    // Sort transactions by date (newest first)
    allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      transactions: allTransactions,
      stats,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
});