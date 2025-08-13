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
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type'); // 'purchase', 'usage', 'refund', 'bonus'
    
    const userId = session.user.id === 'demo' ? 'demo-user' : session.user.id;
    
    // Get user's transactions
    let transactions = db.getUserTransactions(userId, limit);
    
    // Filter by type if specified
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Enhance transactions with model names for usage transactions
    const enhancedTransactions = transactions.map(transaction => {
      if (transaction.modelId) {
        const model = db.getModelById(transaction.modelId);
        return {
          ...transaction,
          modelName: model?.name || 'Unknown Model',
          modelVendor: model?.vendor || 'Unknown',
        };
      }
      return transaction;
    });
    
    return NextResponse.json({
      transactions: enhancedTransactions,
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
