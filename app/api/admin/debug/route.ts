import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { withAdmin } from '@/lib/admin';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    // Get all users
    const allUsers = await clerkClient.users.getUserList({ limit: 100 });
    
    let totalUsers = 0;
    let usersWithTransactions = 0;
    let totalTransactions = 0;
    let usageTransactions = 0;
    const sampleTransactions: any[] = [];
    
    for (const user of allUsers.data) {
      totalUsers++;
      const transactions = (user.privateMetadata?.transactions as any[]) || [];
      
      if (transactions.length > 0) {
        usersWithTransactions++;
        totalTransactions += transactions.length;
        
        const usage = transactions.filter(t => t.type === 'usage_charge');
        usageTransactions += usage.length;
        
        // Collect first few transactions as samples
        if (sampleTransactions.length < 5) {
          usage.slice(0, 2).forEach(t => {
            sampleTransactions.push({
              userEmail: user.emailAddresses[0]?.emailAddress,
              type: t.type,
              createdAt: t.createdAt,
              amount: t.amount,
              metadata: t.metadata
            });
          });
        }
      }
    }
    
    return NextResponse.json({
      debug: {
        totalUsers,
        usersWithTransactions,
        totalTransactions,
        usageTransactions,
        sampleTransactions,
        currentDate: new Date().toISOString(),
        lastWeekRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ error: 'Failed to get debug info' }, { status: 500 });
  }
});