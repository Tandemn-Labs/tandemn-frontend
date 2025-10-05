'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCredits, formatCurrency } from '@/lib/credits-client';

interface TransactionDetail {
  id: string;
  type: 'credit_purchase' | 'usage_charge' | 'bonus_credit' | 'refund';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageId?: string;
  metadata?: {
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
    addedByAdmin?: boolean;
    [key: string]: any;
  };
}

interface TransactionStats {
  totalTransactions: number;
  totalRevenue: number;
  totalCreditsUsed: number;
  totalCreditsIssued: number;
  avgTransactionValue: number;
  transactionsByType: {
    credit_purchase: number;
    usage_charge: number;
    bonus_credit: number;
    refund: number;
  };
  transactionsToday: number;
  transactionsThisWeek: number;
  topModels: Array<{
    modelId: string;
    usage: number;
    revenue: number;
  }>;
}

interface DateFilter {
  startDate: string;
  endDate: string;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionDetail[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, searchTerm, typeFilter, dateFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/transactions');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      setTransactions(data.transactions);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = transactions;

    // Text search
    if (searchTerm) {
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.metadata?.modelId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    // Date filter
    if (dateFilter.startDate) {
      filtered = filtered.filter(tx => 
        new Date(tx.createdAt) >= new Date(dateFilter.startDate)
      );
    }
    if (dateFilter.endDate) {
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(tx => 
        new Date(tx.createdAt) <= endDate
      );
    }

    setFilteredTransactions(filtered);
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'credit_purchase': return 'bg-green-100 text-green-800';
      case 'usage_charge': return 'bg-red-100 text-red-800';
      case 'bonus_credit': return 'bg-blue-100 text-blue-800';
      case 'refund': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading transaction analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="text-xl font-semibold">Error</p>
              <p className="mt-2">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transaction Analytics</h1>
        <Button onClick={fetchTransactions} variant="outline">
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">From credit purchases</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCredits(Math.abs(stats.totalCreditsUsed))}</div>
              <p className="text-xs text-muted-foreground">API usage charges</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Issued</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCredits(stats.totalCreditsIssued)}</div>
              <p className="text-xs text-muted-foreground">Purchases + bonuses</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCredits(stats.avgTransactionValue)}</div>
              <p className="text-xs text-muted-foreground">Per transaction</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="credit_purchase">Credit Purchases</option>
              <option value="usage_charge">Usage Charges</option>
              <option value="bonus_credit">Bonus Credits</option>
              <option value="refund">Refunds</option>
            </select>
            
            <Input
              type="date"
              placeholder="Start Date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
            />
            
            <Input
              type="date"
              placeholder="End Date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History ({filteredTransactions.length} transactions)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Status</th>
                      <th className="text-left p-2">Model/Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={`${tx.userId}-${tx.id}`} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-sm">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <Badge className={getTransactionTypeColor(tx.type)}>
                            {tx.type.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div>
                            <div className="font-medium text-sm">{tx.userName}</div>
                            <div className="text-xs text-gray-600">{tx.userEmail}</div>
                          </div>
                        </td>
                        <td className="p-2 text-sm">{tx.description}</td>
                        <td className="p-2 text-right font-medium">
                          <span className={tx.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                            {tx.amount < 0 ? '-' : '+'}{formatCredits(Math.abs(tx.amount))}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                            {tx.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-sm">
                          {tx.metadata?.modelId && (
                            <div>
                              <div className="font-medium">{tx.metadata.modelId}</div>
                              {tx.metadata.inputTokens && tx.metadata.outputTokens && (
                                <div className="text-xs text-gray-600">
                                  {tx.metadata.inputTokens}in / {tx.metadata.outputTokens}out
                                </div>
                              )}
                            </div>
                          )}
                          {tx.metadata?.addedByAdmin && (
                            <Badge variant="outline" className="text-xs">Admin Added</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {stats && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Credit Purchases</span>
                      <Badge variant="outline">{stats.transactionsByType.credit_purchase}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Usage Charges</span>
                      <Badge variant="outline">{stats.transactionsByType.usage_charge}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bonus Credits</span>
                      <Badge variant="outline">{stats.transactionsByType.bonus_credit}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Refunds</span>
                      <Badge variant="outline">{stats.transactionsByType.refund}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Transactions Today</span>
                      <Badge variant="outline">{stats.transactionsToday}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Transactions This Week</span>
                      <Badge variant="outline">{stats.transactionsThisWeek}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Transactions</span>
                      <Badge variant="outline">{stats.totalTransactions}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stats.topModels.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Top Models by Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Model</th>
                            <th className="text-right p-2">Usage Count</th>
                            <th className="text-right p-2">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.topModels.map((model, index) => (
                            <tr key={model.modelId} className="border-b">
                              <td className="p-2 font-medium">{model.modelId}</td>
                              <td className="p-2 text-right">{model.usage}</td>
                              <td className="p-2 text-right">{formatCredits(model.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}