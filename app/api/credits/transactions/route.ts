import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTransactionHistory } from '@/lib/credits';
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
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    
    // Get transaction history from Clerk metadata
    let transactions = await getTransactionHistory(userId);
    
    // Filter by type if specified
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Apply limit
    transactions = transactions.slice(0, limit);
    
    return NextResponse.json({
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    console.error('Error in /api/credits/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
