'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Zap,
  Activity,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import { formatCurrency, CREDIT_PACKAGES } from '@/lib/stripe';

type CreditBalance = {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: string;
};

type Transaction = {
  id: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number;
  description: string;
  modelId?: string;
  modelName?: string;
  modelVendor?: string;
  tokens?: number;
  createdAt: string;
};

type UsageStats = {
  totalTokens: number;
  totalCost: number;
  period: string;
};

type ModelUsage = {
  modelId: string;
  modelName: string;
  modelVendor: string;
  tokens: number;
  cost: number;
  count: number;
};

export default function CreditsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [modelBreakdown, setModelBreakdown] = useState<ModelUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/signin');
      return;
    }
  }, [session, status, router]);

  // Fetch data
  useEffect(() => {
    if (!session) return;
    
    Promise.all([
      fetchCreditBalance(),
      fetchTransactions(),
      fetchUsageData(),
    ]).finally(() => setLoading(false));
  }, [session]);

  const fetchCreditBalance = async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditBalance(data);
      }
    } catch (error) {
      console.error('Failed to fetch credit balance:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/credits/transactions?limit=10');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/credits/usage?days=30');
      if (response.ok) {
        const data = await response.json();
        setUsageStats(data.stats);
        setModelBreakdown(data.modelBreakdown);
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    }
  };

  const handlePurchase = async (packageId: string) => {
    setPurchaseLoading(packageId);
    
    try {
      // Create payment intent
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      
      if (!response.ok) throw new Error('Failed to create payment');
      
      const { paymentIntentId } = await response.json();
      
      // Simulate payment confirmation (in real app, this would use Stripe's frontend)
      const confirmResponse = await fetch('/api/credits/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, packageId }),
      });
      
      if (confirmResponse.ok) {
        const result = await confirmResponse.json();
        // Refresh data
        await Promise.all([
          fetchCreditBalance(),
          fetchTransactions(),
          fetchUsageData(),
        ]);
        
        alert(`Successfully added ${formatCurrency(result.creditsAdded)} in credits!`);
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setPurchaseLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'usage':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'refund':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'bonus':
        return <Zap className="h-4 w-4 text-yellow-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Credits</h1>
        <p className="text-muted-foreground">
          Manage your account balance and view usage analytics
        </p>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(creditBalance?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Available credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(creditBalance?.totalEarned || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              All-time earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(creditBalance?.totalSpent || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              All-time usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(usageStats?.totalCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {usageStats?.totalTokens.toLocaleString() || 0} tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Packages */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Buy Credits
          </CardTitle>
          <CardDescription>
            Purchase credits to use AI models. Larger packages include bonus credits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <Card key={pkg.id} className={`relative ${pkg.popular ? 'border-primary' : ''}`}>
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default" className="text-xs">
                      Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <div className="text-2xl font-bold">
                    {formatCurrency(pkg.credits)}
                  </div>
                  {pkg.bonus && (
                    <div className="text-sm text-green-600 font-medium">
                      +{formatCurrency(pkg.bonus)} bonus
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    className="w-full" 
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchaseLoading === pkg.id}
                  >
                    {purchaseLoading === pkg.id ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </div>
                    ) : (
                      `Buy for ${formatCurrency(pkg.price / 100)}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="models">Model Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Your recent credit transactions and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No transactions yet
                  </p>
                ) : (
                  transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(transaction.createdAt)}
                            {transaction.tokens && (
                              <span className="ml-2">• {transaction.tokens.toLocaleString()} tokens</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`font-medium ${
                        transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Summary</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Tokens</span>
                  <span className="font-bold">
                    {usageStats?.totalTokens.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Cost</span>
                  <span className="font-bold">
                    {formatCurrency(usageStats?.totalCost || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Average per Day</span>
                  <span className="font-bold">
                    {formatCurrency((usageStats?.totalCost || 0) / 30)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Current period insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Models Used</span>
                  <span className="font-bold">{modelBreakdown.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Most Used</span>
                  <span className="font-bold text-sm">
                    {modelBreakdown[0]?.modelName || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Highest Cost</span>
                  <span className="font-bold">
                    {formatCurrency(modelBreakdown[0]?.cost || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Model Usage Breakdown</CardTitle>
              <CardDescription>
                Detailed breakdown by model for the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modelBreakdown.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No usage data available
                  </p>
                ) : (
                  modelBreakdown.map((model) => (
                    <div
                      key={model.modelId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{model.modelName}</div>
                          <div className="text-sm text-muted-foreground">
                            {model.modelVendor} • {model.count} requests
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(model.cost)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {model.tokens.toLocaleString()} tokens
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
