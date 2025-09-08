import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/stripe';
import { addCredits, addTransaction } from '@/lib/credits';
import Stripe from 'stripe';

// Disable body parser for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyStripeSignature(body, signature);
    } catch (error) {
      console.error('Invalid Stripe signature:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        const { userId, packageId, creditsAmount } = session.metadata || {};
        
        if (!userId || !packageId || !creditsAmount) {
          console.error('Missing required metadata in checkout session:', session.metadata);
          return NextResponse.json(
            { error: 'Missing required metadata' },
            { status: 400 }
          );
        }

        const credits = parseFloat(creditsAmount);
        
        try {
          // Add credits to user account
          const success = await addCredits(userId, credits);
          
          if (success) {
            // Record the transaction
            await addTransaction(userId, {
              type: 'credit_purchase',
              amount: credits,
              description: `Stripe purchase: ${packageId}`,
              status: 'completed',
              metadata: {
                stripeSessionId: session.id,
                packageId,
                stripePaymentIntentId: session.payment_intent as string,
              },
            });

            console.log(`✅ Successfully added ${credits} credits to user ${userId}`);
          } else {
            console.error(`❌ Failed to add credits to user ${userId}`);
            
            // Log failed transaction
            await addTransaction(userId, {
              type: 'credit_purchase',
              amount: credits,
              description: `Failed Stripe purchase: ${packageId}`,
              status: 'failed',
              metadata: {
                stripeSessionId: session.id,
                packageId,
                error: 'Failed to add credits to account',
              },
            });
          }
        } catch (error) {
          console.error('Error processing credit purchase:', error);
          
          // Log error transaction
          await addTransaction(userId, {
            type: 'credit_purchase',
            amount: credits,
            description: `Error in Stripe purchase: ${packageId}`,
            status: 'failed',
            metadata: {
              stripeSessionId: session.id,
              packageId,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
        
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment failed for: ${paymentIntent.id}`);
        
        // You could implement additional failure handling here
        // For example, sending an email notification or logging to analytics
        
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}