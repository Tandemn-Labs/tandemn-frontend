// Credit package configurations for Stripe - safe for client-side import
export const STRIPE_CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 5.00, // $5 in credits
    price: 500, // $5.00 in cents
    currency: 'usd',
    description: '$5 in API credits',
  },
  {
    id: 'basic',
    name: 'Basic Pack',
    credits: 10.00, // $10 in credits
    price: 1000, // $10.00 in cents
    currency: 'usd',
    description: '$10 in API credits',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    credits: 25.00, // $25 in credits
    price: 2500, // $25.00 in cents
    currency: 'usd',
    description: '$25 in API credits',
  },
  {
    id: 'business',
    name: 'Business Pack',
    credits: 50.00, // $50 in credits
    price: 5000, // $50.00 in cents
    currency: 'usd',
    description: '$50 in API credits',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 100.00, // $100 in credits
    price: 10000, // $100.00 in cents
    currency: 'usd',
    description: '$100 in API credits',
  },
];