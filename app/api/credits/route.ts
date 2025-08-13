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
    
    const userId = session.user.id === 'demo' ? 'demo-user' : session.user.id;
    
    // Get user's credit balance
    const creditBalance = db.getCreditBalance(userId);
    const user = db.getUser(userId);
    
    if (!creditBalance || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      balance: creditBalance.balance,
      totalEarned: creditBalance.totalEarned,
      totalSpent: creditBalance.totalSpent,
      lastUpdated: creditBalance.lastUpdated,
    });
  } catch (error) {
    console.error('Error in /api/credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
