'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Wallet, 
  TrendingUp, 
  RefreshCw, 
  Calendar,
  DollarSign,
  Activity,
  CreditCard,
  Plus
} from 'lucide-react';
import { type Transaction } from '@/lib/credits-client';

export default function CreditsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('5.00');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchCredits();
      fetchTransactions();
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    // Check for URL parameters on page load
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      setSuccessMessage('Payment successful! Your credits have been added to your account.');
      // Refresh data to show new credits
      if (isLoaded && isSignedIn) {
        fetchCredits();
        fetchTransactions();
      }
      // Clean URL after showing success message
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (canceled === 'true') {
      setCancelMessage('Payment was canceled. No charges were made.');
      // Clean URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [isLoaded, isSignedIn]);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/credits/transactions');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    setTransactionsLoading(true);
    await Promise.all([fetchCredits(), fetchTransactions()]);
  };

  const purchaseCustomCredits = async () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 1) {
      alert('Please enter a valid amount (minimum $1.00)');
      return;
    }
    if (amount > 1000) {
      alert('Maximum amount is $1000.00. For larger purchases, please contact support.');
      return;
    }

    setPurchasing(true);
    try {
      // Create custom package for Stripe
      const customPackage = {
        id: 'custom',
        name: 'Custom Credits',
        credits: amount,
        price: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        description: `$${amount} in API credits`,
      };

      // Create Stripe checkout session with custom amount
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          packageId: customPackage.id,
          customAmount: amount,
          customPackage 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-3xl font-bold mb-4">Credits & Billing</h1>
          <p className="text-muted-foreground mb-8">Please sign in to view your credits and billing information.</p>
          <Link href="/sign-in">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate usage stats
  const usageTransactions = transactions.filter(t => t.type === 'usage_charge');
  const purchaseTransactions = transactions.filter(t => t.type === 'credit_purchase');
  const totalSpent = usageTransactions.reduce((total, t) => total + Math.abs(t.amount), 0);
  const totalPurchased = purchaseTransactions.reduce((total, t) => total + t.amount, 0);

  // Recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTransactions = transactions.filter(t => 
    new Date(t.createdAt) >= thirtyDaysAgo
  );
  const recentSpent = recentTransactions
    .filter(t => t.type === 'usage_charge')
    .reduce((total, t) => total + Math.abs(t.amount), 0);

  // Calculate most used model
  const modelUsage = usageTransactions.reduce((acc, t) => {
    const modelId = t.metadata?.modelId || 'Unknown';
    acc[modelId] = (acc[modelId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostUsedModel = Object.entries(modelUsage).reduce((max, [model, count]) => {
    return count > (max.count || 0) ? { model, count } : max;
  }, { model: 'N/A', count: 0 }).model;

  const avgCostPerCall = usageTransactions.length > 0 
    ? (totalSpent / usageTransactions.length).toFixed(4)
    : '0.0000';

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Credits & Billing</h1>
            <p className="text-muted-foreground">
              Manage your account balance and billing
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={loading || transactionsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(loading || transactionsLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">{successMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                className="inline-flex rounded-md bg-green-50 dark:bg-green-950/50 p-1.5 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/50 focus:outline-none"
                onClick={() => setSuccessMessage(null)}
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelMessage && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{cancelMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                className="inline-flex rounded-md bg-yellow-50 dark:bg-yellow-950/50 p-1.5 text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 focus:outline-none"
                onClick={() => setCancelMessage(null)}
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance and Usage Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Current Balance - Extra Large Card on Left (reduced by 20%) */}
        <Card className="lg:col-span-7 bg-gradient-to-br from-primary/10 to-primary/5 h-[280px] flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-medium flex items-center gap-3">
              <Wallet className="h-6 w-6" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            <div className="text-7xl font-bold mb-4">
              {loading ? (
                <div className="h-20 w-48 bg-muted animate-pulse rounded"></div>
              ) : (
                `$${credits.toFixed(2)}`
              )}
            </div>
            <p className="text-lg text-muted-foreground">Available credits</p>
          </CardContent>
        </Card>

        {/* Right Side - Usage Stats Stacked */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Total Usage */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All-time API usage</p>
            </CardContent>
          </Card>

          {/* Last 30 Days */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${recentSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Recent usage</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Large Add Money Button */}
      <div className="mb-8">
        <Button 
          onClick={() => setShowPurchaseModal(true)} 
          disabled={purchasing}
          size="lg"
          className="w-full h-16 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          {purchasing ? (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <>
              <Plus className="h-6 w-6 mr-3" />
              Add Money
            </>
          )}
        </Button>
      </div>

      {/* Lower Section - Stats and Billing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Most used model</p>
                <p className="text-lg font-semibold">{mostUsedModel}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. cost per call</p>
                <p className="text-lg font-semibold">${avgCostPerCall}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total purchased</p>
                <p className="text-lg font-semibold">${totalPurchased.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total API calls</p>
                <p className="text-lg font-semibold">{usageTransactions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment method</span>
              <span className="text-sm font-medium">Prepaid credits</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Currency</span>
              <span className="text-sm font-medium">USD</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment processor</span>
              <span className="text-sm font-medium">Stripe</span>
            </div>
            <div className="pt-3 border-t space-y-2">
              <div className="text-xs text-muted-foreground">
                <p>• Pay only for what you use</p>
                <p>• No monthly subscriptions</p>
                <p>• Credits never expire</p>
                <p>• Secure payments via Stripe</p>
              </div>
              <Link href="/keys" className="text-primary hover:underline text-sm inline-block mt-3">
                Manage API Keys →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Amount Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
            <DialogDescription>
              Enter the amount you'd like to purchase in USD
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  max="1000"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-10"
                  placeholder="5.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum: $1.00 • Maximum: $1,000.00
              </p>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">You will receive:</span>
              <span className="font-medium">${customAmount || '0.00'} in credits</span>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPurchaseModal(false)}
                className="flex-1"
                disabled={purchasing}
              >
                Cancel
              </Button>
              <Button
                onClick={purchaseCustomCredits}
                disabled={purchasing || !customAmount || parseFloat(customAmount) < 1}
                className="flex-1"
              >
                {purchasing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Purchase'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}