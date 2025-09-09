import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    console.log('DEBUG: Auth result:', { userId });
    console.log('DEBUG: Request headers:', Object.fromEntries(request.headers.entries()));
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', debug: { hasAuthHeader: !!request.headers.get('authorization'), cookieHeader: request.headers.get('cookie') ? 'present' : 'missing' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { packageId, customAmount, customPackage } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Get user email from Clerk
    const { createClerkClient } = await import('@clerk/nextjs/server');
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    const user = await clerkClient.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout session
    const session = await createCheckoutSession({
      packageId,
      userId,
      userEmail,
      customAmount,
      customPackage,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}