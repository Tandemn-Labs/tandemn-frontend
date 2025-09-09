import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if all required environment variables are present
    const requiredEnvVars = {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing environment variables',
        missing: missingVars
      }, { status: 500 });
    }

    // Test Stripe connection
    const { stripe } = await import('@/lib/stripe');
    const account = await stripe.accounts.retrieve();

    return NextResponse.json({
      status: 'success',
      message: 'All environment variables present and Stripe connection working',
      stripeAccountId: account.id,
      domain: process.env.NEXT_PUBLIC_DOMAIN
    });

  } catch (error) {
    console.error('Stripe test error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Stripe connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}