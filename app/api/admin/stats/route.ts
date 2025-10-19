import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';
import dbConnect from '@/lib/database';
import UserAccount from '@/lib/models/UserAccount';
import UserTransaction from '@/lib/models/UserTransaction';

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
    await dbConnect();

    // Get all user accounts from MongoDB
    const accounts = await UserAccount.find({}).sort({ createdAt: -1 });
    
    // Get all Clerk users for additional info
    const usersResponse = await clerkClient.users.getUserList({ limit: 500 });
    const clerkUsers = usersResponse.data;
    
    // Create a map of Clerk users for quick lookup
    const clerkUserMap = new Map(clerkUsers.map(user => [user.id, user]));

    // Fetch all transactions for all users in a single query to avoid N+1 problem
    const accountIds = accounts.map(acc => acc._id.toString());
    const allTransactions = await UserTransaction.find({ userId: { $in: accountIds } });

    // Group transactions by user ID for efficient lookup
    const transactionsByUserId = new Map<string, any[]>();
    for (const transaction of allTransactions) {
      const userId = transaction.userId.toString();
      if (!transactionsByUserId.has(userId)) {
        transactionsByUserId.set(userId, []);
      }
      transactionsByUserId.get(userId)!.push(transaction);
    }

    const userStats: UserStats[] = [];
    let totalCredits = 0;
    let totalRevenue = 0;
    let activeUsers = 0;

    for (const account of accounts) {
      const clerkUser = clerkUserMap.get(account.clerkUserId);
      const isAdminUser = clerkUser?.publicMetadata?.role === 'admin' || clerkUser?.publicMetadata?.isAdmin === true;
      
      // Get transactions for this user from the pre-fetched map
      const transactions = (transactionsByUserId.get(account._id.toString()) || [])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
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
        
        if (!lastActivity || transaction.createdAt > new Date(lastActivity)) {
          lastActivity = transaction.createdAt.toISOString();
        }
      }

      // If no last activity from transactions, use account creation date
      if (!lastActivity) {
        lastActivity = account.createdAt.toISOString();
      }

      const userStat: UserStats = {
        id: account.clerkUserId,
        email: account.email,
        name: clerkUser ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'No name' : 'No name',
        credits: account.credits,
        totalTransactions: transactions.length,
        lastActivity,
        joinedAt: account.createdAt.toISOString(),
        isAdmin: isAdminUser,
        totalSpent,
        totalEarned,
      };

      userStats.push(userStat);
      totalCredits += account.credits;
      
      if (account.credits > 0) {
        activeUsers++;
      }
    }

    const adminStats: AdminStats = {
      totalUsers: accounts.length,
      totalCredits,
      totalRevenue,
      avgCreditsPerUser: accounts.length > 0 ? totalCredits / accounts.length : 0,
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