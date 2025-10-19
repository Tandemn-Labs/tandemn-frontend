import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { addCredits, addTransaction } from '@/lib/credits';

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const { userId, amount } = await request.json();

    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid userId or amount' },
        { status: 400 }
      );
    }

    // Add credits to user
    const success = await addCredits(userId, amount);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add credits' },
        { status: 500 }
      );
    }

    // Add transaction record
    await addTransaction(userId, {
      type: 'bonus_credit',
      amount,
      description: `Admin added ${amount} credits`,
      metadata: {
        addedByAdmin: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${amount} credits to user`,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return NextResponse.json(
      { error: 'Failed to add credits' },
      { status: 500 }
    );
  }
});