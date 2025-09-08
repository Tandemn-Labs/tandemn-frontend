# Stripe Payment Integration Setup Guide

## Overview
Your application now has real Stripe payment integration with Clerk authentication for credit purchases. This guide will help you set up and test the payment system.

## Prerequisites
1. Stripe Account: [Sign up at stripe.com](https://dashboard.stripe.com/register)
2. Clerk Account: Already configured in your project
3. Development Environment: Node.js project running locally

## Setup Steps

### 1. Get Your Stripe API Keys
1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API keys**
3. Copy your **Test** keys (for development):
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### 2. Update Environment Variables
Edit your `.env` file and replace the placeholder values:

```env
# Replace these with your actual Stripe test keys:
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_publishable_key_here
```

### 3. Set Up Stripe Webhook (For Production)
For local development, webhooks will work automatically. For production:

1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL to: `https://yourdomain.com/api/stripe/webhook`
4. Select events to send:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** and add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_endpoint_secret_here
   ```

## Credit Packages Available

The system offers 5 credit packages:
- **Starter Pack**: $5.00 (5 credits)
- **Basic Pack**: $10.00 (10 credits) - Most Popular
- **Pro Pack**: $25.00 (25 credits)
- **Business Pack**: $50.00 (50 credits)
- **Enterprise Pack**: $100.00 (100 credits)

## Testing the Payment Flow

### Using Stripe Test Cards
Use these test card numbers in Stripe Checkout:

- **Successful payment**: `4242 4242 4242 4242`
- **Declined payment**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

Use any future expiration date, any 3-digit CVC, and any postal code.

### Test Workflow
1. Sign in to your application
2. Go to `/credits` page
3. Click **Purchase** on any credit package
4. You'll be redirected to Stripe Checkout
5. Use a test card number above
6. Complete the payment
7. You'll be redirected back to `/credits?success=true`
8. Credits should be added to your account
9. Check the **Transaction History** tab

## Implementation Details

### Files Created/Modified
- `src/lib/stripe.ts` - Stripe configuration and checkout session creation
- `app/api/stripe/checkout/route.ts` - Checkout session API endpoint
- `app/api/stripe/webhook/route.ts` - Webhook handler for payment events
- `app/credits/page.tsx` - Updated to use real Stripe checkout
- `.env` - Added Stripe environment variables

### Credit System Integration
- Credits are automatically added upon successful payment
- Transaction history tracks all purchases and API usage
- Users cannot make API calls if credits are exhausted
- Real-time credit balance updates

### Security Features
- Webhook signature verification
- User authentication with Clerk
- Secure API key handling
- Error logging and transaction tracking

## Troubleshooting

### Common Issues
1. **"Invalid API key"**: Check your `.env` file has correct Stripe keys
2. **Webhook signature verification failed**: Ensure `STRIPE_WEBHOOK_SECRET` is correct
3. **Payment not processing**: Check Stripe Dashboard for payment status
4. **Credits not added**: Check server logs for webhook processing errors

### Debug Steps
1. Check browser console for JavaScript errors
2. Check server logs for API errors
3. Verify webhook delivery in Stripe Dashboard
4. Test with different browsers/incognito mode

## Going Live

When ready for production:
1. Replace test API keys with live keys from Stripe
2. Set up production webhook endpoints
3. Update `NEXT_PUBLIC_DOMAIN` to your production URL
4. Test thoroughly with small amounts first

## Support
- Stripe Documentation: https://docs.stripe.com
- Clerk Documentation: https://clerk.com/docs
- Test your integration: https://dashboard.stripe.com/test/payments

---

**Note**: Always test thoroughly in development before going live. Never commit actual API keys to version control.