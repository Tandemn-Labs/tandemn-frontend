import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserCredits } from '@/lib/credits';
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
    
    // Get user's credit balance from Clerk metadata
    const balance = await getUserCredits(userId);
    
    return NextResponse.json({
      balance,
      totalEarned: balance, // For now, assume all credits are earned
      totalSpent: 0, // Calculate from transaction history if needed
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
