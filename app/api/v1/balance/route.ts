import { NextRequest, NextResponse } from 'next/server';
import { validateAPIKey, getUserCredits, getTransactionHistory } from '@/lib/credits';

// GET /api/v1/balance - Get user's current credit balance
export async function GET(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate API key
    const validation = await validateAPIKey(apiKey);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = validation.userId;

    // Get current balance
    const balance = await getUserCredits(userId);
    
    // Get recent transactions for additional context
    const transactions = await getTransactionHistory(userId);
    const recentTransactions = transactions.slice(0, 5);
    
    // Calculate usage stats for this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyTransactions = transactions.filter(tx => 
      tx.type === 'usage_charge' && new Date(tx.createdAt) >= startOfMonth
    );
    
    const monthlySpent = monthlyTransactions.reduce((total, tx) => total + Math.abs(tx.amount), 0);
    const monthlyApiCalls = monthlyTransactions.length;

    return NextResponse.json({
      data: {
        balance: Math.round(balance * 10000) / 10000, // Round to 4 decimal places
        currency: 'USD',
        monthly_usage: {
          spent: Math.round(monthlySpent * 10000) / 10000,
          api_calls: monthlyApiCalls,
          period: `${startOfMonth.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`
        },
        recent_transactions: recentTransactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          created_at: tx.createdAt,
          metadata: tx.metadata
        }))
      }
    });
  } catch (error) {
    console.error('Error in /api/v1/balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}