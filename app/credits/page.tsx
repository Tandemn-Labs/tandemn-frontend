'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Plus, Zap, History, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { CREDIT_PACKAGES, type Transaction } from '@/lib/credits-client';
import { STRIPE_CREDIT_PACKAGES } from '@/lib/stripe-config';

export default function CreditsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchCredits();
      fetchTransactions();
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

  const purchaseCredits = async (packageId: string) => {
    setPurchasing(packageId);
    try {
      // Create Stripe checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
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
      setPurchasing(null);
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Credits</h1>
          <p className="text-muted-foreground mb-8">Please sign in to view and purchase credits.</p>
        </div>
      </div>
    );
  }

  const getTransactionIcon = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'credit_purchase':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'usage_charge':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'bonus_credit':
        return <Zap className="h-4 w-4 text-blue-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTransactionDescription = (transaction: Transaction) => {
    if (transaction.metadata?.modelId) {
      const { modelId, inputTokens, outputTokens, backend } = transaction.metadata;
      return `${modelId} (${inputTokens || 0} in + ${outputTokens || 0} out tokens${backend ? `, via ${backend}` : ''})`;
    }
    return transaction.description;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Credits</h1>
            <p className="text-muted-foreground">
              Token-based pricing: Pay for what you use. Manage your credits and track usage.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={loading || transactionsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(loading || transactionsLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Balance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary">${credits.toFixed(2)}</div>
              <div className="text-muted-foreground">
                <div>Credits Available</div>
                <div className="text-sm">~{Math.floor(credits * 10)} input tokens or ~{Math.floor(credits * 5)} output tokens</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Purchase Credits and Transaction History */}
      <Tabs defaultValue="purchase" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="purchase">Purchase Credits</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Purchase Credits
              </CardTitle>
              <CardDescription>
                Select a credit package below. Pay only for what you use with our token-based pricing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STRIPE_CREDIT_PACKAGES.map((pkg) => (
                  <Card key={pkg.id} className={`relative ${pkg.popular ? 'border-primary' : ''}`}>
                    {pkg.popular && (
                      <Badge className="absolute -top-2 left-4 bg-primary">
                        Popular
                      </Badge>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <div className="text-3xl font-bold text-primary">
                        ${(pkg.price / 100).toFixed(0)}
                      </div>
                      <CardDescription>
                        ${pkg.credits} credits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        onClick={() => purchaseCredits(pkg.id)}
                        disabled={purchasing === pkg.id}
                      >
                        {purchasing === pkg.id ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Purchasing...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Purchase ${(pkg.price / 100).toFixed(0)}
                          </div>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription>
                Detailed record of all credit purchases and API usage charges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No transactions yet.</p>
                  <p className="text-sm text-muted-foreground">Start using the API or purchase credits to see your transaction history.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getTransactionIcon(transaction)}
                        <div>
                          <p className="font-medium">{formatTransactionDescription(transaction)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleString()}
                          </p>
                          {transaction.metadata?.cost && (
                            <p className="text-xs text-muted-foreground">
                              Actual cost: ${transaction.metadata.cost.toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(4)}
                        </p>
                        <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}