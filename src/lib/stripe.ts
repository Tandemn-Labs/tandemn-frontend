import Stripe from 'stripe';

// Initialize Stripe with dummy keys for development
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_development_only';

if (!stripeSecretKey.startsWith('sk_')) {
  console.warn('⚠️  Using dummy Stripe key for development. Replace with real keys for production.');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-07-30.basil',
  typescript: true,
});

// Dummy implementation for demo purposes
export const createDummyPaymentIntent = async (amount: number, currency = 'usd') => {
  // In a real implementation, this would be:
  // return await stripe.paymentIntents.create({ amount, currency });
  
  // For demo, return a dummy payment intent
  return {
    id: `pi_dummy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    client_secret: `pi_dummy_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency,
    status: 'requires_payment_method' as const,
    created: Math.floor(Date.now() / 1000),
    metadata: {},
  };
};

export const simulatePaymentSuccess = async (paymentIntentId: string) => {
  // Simulate payment completion for demo
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    id: paymentIntentId,
    status: 'succeeded' as const,
    amount_received: 1000, // dummy amount
    currency: 'usd',
    payment_method: 'card_dummy_method',
    created: Math.floor(Date.now() / 1000),
  };
};

// Credit packages
export const CREDIT_PACKAGES = [
  {
    id: 'credits_5',
    name: '$5 Credits',
    credits: 5.00,
    price: 500, // in cents
    popular: false,
  },
  {
    id: 'credits_10',
    name: '$10 Credits',
    credits: 10.00,
    price: 1000,
    popular: false,
  },
  {
    id: 'credits_25',
    name: '$25 Credits',
    credits: 25.00,
    price: 2500,
    popular: true,
    bonus: 2.50, // 10% bonus
  },
  {
    id: 'credits_50',
    name: '$50 Credits',
    credits: 50.00,
    price: 5000,
    popular: false,
    bonus: 7.50, // 15% bonus
  },
  {
    id: 'credits_100',
    name: '$100 Credits',
    credits: 100.00,
    price: 10000,
    popular: false,
    bonus: 20.00, // 20% bonus
  },
];

export const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};
