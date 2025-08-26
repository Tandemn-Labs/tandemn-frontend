import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { giveWelcomeCredits } from '@/lib/credits';

const webhookSecret: string = process.env.CLERK_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature headers' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    let evt;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // Handle user creation event
    if ((evt as any).type === 'user.created') {
      const { id: userId } = (evt as any).data;
      
      // Give welcome credits to new user
      await giveWelcomeCredits(userId);
      
      console.log(`Welcome credits given to new user: ${userId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}