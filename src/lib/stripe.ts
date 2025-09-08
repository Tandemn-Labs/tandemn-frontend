import Stripe from 'stripe';
import { STRIPE_CREDIT_PACKAGES } from './stripe-config';

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
});

// Client-side publishable key
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

// Re-export credit packages
export { STRIPE_CREDIT_PACKAGES };

// Create Stripe Checkout Session
export async function createCheckoutSession({
  packageId,
  userId,
  userEmail,
}: {
  packageId: string;
  userId: string;
  userEmail: string;
}) {
  const creditPackage = STRIPE_CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
  
  if (!creditPackage) {
    throw new Error(`Invalid credit package: ${packageId}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: creditPackage.currency,
          product_data: {
            name: creditPackage.name,
            description: creditPackage.description,
            images: ['https://your-domain.com/credit-icon.png'], // Optional: Add credit icon
          },
          unit_amount: creditPackage.price,
        },
        quantity: 1,
      },
    ],
    mode: 'payment', // One-time payment (not subscription)
    success_url: `${process.env.NEXT_PUBLIC_DOMAIN}/credits?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/credits?canceled=true`,
    customer_email: userEmail,
    metadata: {
      userId,
      packageId,
      creditsAmount: creditPackage.credits.toString(),
      type: 'credit_purchase',
    },
  });

  return session;
}

// Verify Stripe webhook signature
export function verifyStripeSignature(body: string, signature: string): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error}`);
  }
}