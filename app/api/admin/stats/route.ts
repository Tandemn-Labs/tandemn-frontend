import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface UserStats {
  id: string;
  email: string;
  name: string;
  credits: number;
  totalTransactions: number;
  lastActivity: string;
  joinedAt: string;
  isAdmin: boolean;
  totalSpent: number;
  totalEarned: number;
}

interface AdminStats {
  totalUsers: number;
  totalCredits: number;
  totalRevenue: number;
  avgCreditsPerUser: number;
  activeUsers: number;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    // Get all users from Clerk
    const usersResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = usersResponse.data;

    const userStats: UserStats[] = [];
    let totalCredits = 0;
    let totalRevenue = 0;
    let activeUsers = 0;

    for (const user of users) {
      const credits = (user.privateMetadata?.credits as number) || 0;
      const transactions = (user.privateMetadata?.transactions as any[]) || [];
      const isAdminUser = user.publicMetadata?.role === 'admin' || user.publicMetadata?.isAdmin === true;
      
      // Calculate totals from transactions
      let totalSpent = 0;
      let totalEarned = 0;
      let lastActivity = '';

      for (const transaction of transactions) {
        if (transaction.type === 'usage_charge' && transaction.amount < 0) {
          totalSpent += Math.abs(transaction.amount);
        } else if (transaction.type === 'credit_purchase' || transaction.type === 'bonus_credit') {
          totalEarned += transaction.amount;
          totalRevenue += transaction.amount;
        }
        
        if (!lastActivity || new Date(transaction.createdAt) > new Date(lastActivity)) {
          lastActivity = transaction.createdAt;
        }
      }

      // If no last activity from transactions, use last sign in or creation date
      if (!lastActivity) {
        lastActivity = user.lastSignInAt?.toString() || user.createdAt?.toString() || new Date().toISOString();
      }

      const userStat: UserStats = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || 'No email',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name',
        credits,
        totalTransactions: transactions.length,
        lastActivity,
        joinedAt: user.createdAt?.toString() || new Date().toISOString(),
        isAdmin: isAdminUser,
        totalSpent,
        totalEarned,
      };

      userStats.push(userStat);
      totalCredits += credits;
      
      if (credits > 0) {
        activeUsers++;
      }
    }

    const adminStats: AdminStats = {
      totalUsers: users.length,
      totalCredits,
      totalRevenue,
      avgCreditsPerUser: users.length > 0 ? totalCredits / users.length : 0,
      activeUsers,
    };

    // Sort users by credits (highest first)
    userStats.sort((a, b) => b.credits - a.credits);

    return NextResponse.json({
      users: userStats,
      adminStats,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
});