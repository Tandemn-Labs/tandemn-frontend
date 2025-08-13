import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/mock/db';
import { createDummyPaymentIntent, CREDIT_PACKAGES } from '@/lib/stripe';
import { sleep } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    await sleep(200);
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { packageId } = await request.json();
    
    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
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
    
    // Create dummy payment intent
    const paymentIntent = await createDummyPaymentIntent(
      creditPackage.price,
      'usd'
    );
    
    // Store pending transaction in database
    const userId = session.user.id === 'demo' ? 'demo-user' : session.user.id;
    const totalCredits = creditPackage.credits + (creditPackage.bonus || 0);
    
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      package: {
        ...creditPackage,
        totalCredits,
      },
    });
  } catch (error) {
    console.error('Error in /api/credits/purchase:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
