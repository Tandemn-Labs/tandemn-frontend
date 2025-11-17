// Client-safe credit utility functions and types
// This file can be imported by client components

// Credit packages available for purchase (1 credit = 1 dollar)
// Unified with Stripe configuration - IDs match STRIPE_CREDIT_PACKAGES
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 5.00,
    price: 500, // Price in cents
    currency: 'usd',
    description: '$5 in API credits',
    popular: false,
  },
  {
    id: 'basic',
    name: 'Basic Pack',
    credits: 10.00,
    price: 1000, // Price in cents
    currency: 'usd',
    description: '$10 in API credits',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    credits: 25.00,
    price: 2500, // Price in cents
    currency: 'usd',
    description: '$25 in API credits',
    popular: false,
  },
  {
    id: 'business',
    name: 'Business Pack',
    credits: 50.00,
    price: 5000, // Price in cents
    currency: 'usd',
    description: '$50 in API credits',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 100.00,
    price: 10000, // Price in cents
    currency: 'usd',
    description: '$100 in API credits',
    popular: false,
  },
];

// Types
export interface Transaction {
  id: string;
  type: 'credit_purchase' | 'usage_charge' | 'bonus_credit' | 'refund';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  modelId?: string;
  tokens?: number;
  packageId?: string;
  metadata?: {
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
    [key: string]: any;
  };
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  isActive: boolean;
}

// Utility functions
export const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatCredits = (credits: number) => {
  return `$${credits.toFixed(2)}`;
};