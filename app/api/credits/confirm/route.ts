import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/mock/db';
import { simulatePaymentSuccess, CREDIT_PACKAGES } from '@/lib/stripe';
import { sleep } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    await sleep(1000); // Simulate payment processing time
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { paymentIntentId, packageId } = await request.json();
    
    if (!paymentIntentId || !packageId) {
      return NextResponse.json(
        { error: 'Payment intent ID and package ID are required' },
        { status: 400 }
      );
    }
    
    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      );
    }
    
    // Simulate payment completion
    const payment = await simulatePaymentSuccess(paymentIntentId);
    
    if (payment.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment failed' },
        { status: 400 }
      );
    }
    
    const userId = session.user.id === 'demo' ? 'demo-user' : session.user.id;
    const totalCredits = creditPackage.credits + (creditPackage.bonus || 0);
    
    // Add transaction to database
    const transaction = db.addTransaction({
      userId,
      type: 'purchase',
      amount: totalCredits,
      description: `Credit purchase - ${creditPackage.name}${creditPackage.bonus ? ` (${creditPackage.bonus} bonus)` : ''}`,
      metadata: {
        stripePaymentId: paymentIntentId,
      },
    });
    
    // Get updated balance
    const creditBalance = db.getCreditBalance(userId);
    
    return NextResponse.json({
      success: true,
      transaction,
      balance: creditBalance?.balance || 0,
      creditsAdded: totalCredits,
    });
  } catch (error) {
    console.error('Error in /api/credits/confirm:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
