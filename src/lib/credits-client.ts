// Client-safe credit utility functions and types
// This file can be imported by client components

// Credit packages available for purchase (1 credit = 1 dollar)
export const CREDIT_PACKAGES = [
  {
    id: 'credits_5',
    name: '5 Credits',
    credits: 5,
    price: 5, // $5 for 5 credits
    popular: false,
  },
  {
    id: 'credits_10',
    name: '10 Credits',
    credits: 10,
    price: 10, // $10 for 10 credits
    popular: false,
  },
  {
    id: 'credits_25',
    name: '25 Credits',
    credits: 25,
    price: 25, // $25 for 25 credits
    popular: true,
  },
  {
    id: 'credits_50',
    name: '50 Credits',
    credits: 50,
    price: 50, // $50 for 50 credits
    popular: false,
  },
  {
    id: 'credits_100',
    name: '100 Credits',
    credits: 100,
    price: 100, // $100 for 100 credits
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