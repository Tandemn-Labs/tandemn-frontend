'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCredits, formatCurrency } from '@/lib/credits-client';

interface UserUsageDetail {
  userId: string;
  userName: string;
  userEmail: string;
  currentCredits: number;
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalMoneySpent: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  modelsUsed: string[];
  lastApiCall: string;
  firstApiCall: string;
  usageByModel: Array<{
    modelId: string;
    apiCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    moneySpent: number;
    avgCostPerCall: number;
  }>;
  dailyUsage: Array<{
    date: string;
    apiCalls: number;
    tokens: number;
    cost: number;
  }>;
}

interface UsageStats {
  totalUsers: number;
  activeUsers: number;
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalRevenue: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  avgTokensPerUser: number;
  topSpenders: Array<{
    userName: string;
    userEmail: string;
    totalSpent: number;
    apiCalls: number;
  }>;
  topModels: Array<{
    modelId: string;
    apiCalls: number;
    totalTokens: number;
    revenue: number;
  }>;
}

export default function AdminUsagePage() {
  const [users, setUsers] = useState<UserUsageDetail[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserUsageDetail[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserUsageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('totalMoneySpent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchUsageData();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [users, searchTerm, sortBy, sortOrder]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/usage-analytics');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch usage data');
      }
      
      setUsers(data.users);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = users;

    // Text search
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.modelsUsed.some(model => model.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortBy as keyof UserUsageDetail] as number;
      const bVal = b[sortBy as keyof UserUsageDetail] as number;
      
      if (sortOrder === 'desc') {
        return bVal - aVal;
      } else {
        return aVal - bVal;
      }
    });

    setFilteredUsers(filtered);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading usage analytics...</p>
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
        <h1 className="text-3xl font-bold">User Usage Analytics</h1>
        <Button onClick={fetchUsageData} variant="outline">
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApiCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all users</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalInputTokens.toLocaleString()}in + {stats.totalOutputTokens.toLocaleString()}out
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">From API usage</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Cost/Call</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCredits(stats.avgCostPerCall)}</div>
              <p className="text-xs text-muted-foreground">{stats.avgTokensPerCall.toFixed(0)} tokens/call</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Usage</TabsTrigger>
          <TabsTrigger value="models">Model Analytics</TabsTrigger>
          <TabsTrigger value="details">User Details</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search by user, email, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Usage Statistics ({filteredUsers.length} users)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">User</th>
                      <th 
                        className="text-right p-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('totalApiCalls')}
                      >
                        API Calls {getSortIcon('totalApiCalls')}
                      </th>
                      <th 
                        className="text-right p-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('totalTokens')}
                      >
                        Total Tokens {getSortIcon('totalTokens')}
                      </th>
                      <th 
                        className="text-right p-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('totalMoneySpent')}
                      >
                        Money Spent {getSortIcon('totalMoneySpent')}
                      </th>
                      <th 
                        className="text-right p-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('avgCostPerCall')}
                      >
                        Avg/Call {getSortIcon('avgCostPerCall')}
                      </th>
                      <th 
                        className="text-right p-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('currentCredits')}
                      >
                        Credits Left {getSortIcon('currentCredits')}
                      </th>
                      <th className="text-left p-2">Models Used</th>
                      <th className="text-left p-2">Last API Call</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.userId} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{user.userName}</div>
                            <div className="text-sm text-gray-600">{user.userEmail}</div>
                          </div>
                        </td>
                        <td className="p-2 text-right font-medium">
                          {user.totalApiCalls.toLocaleString()}
                        </td>
                        <td className="p-2 text-right">
                          <div className="font-medium">{user.totalTokens.toLocaleString()}</div>
                          <div className="text-xs text-gray-600">
                            {user.totalInputTokens.toLocaleString()}in / {user.totalOutputTokens.toLocaleString()}out
                          </div>
                        </td>
                        <td className="p-2 text-right font-medium text-red-600">
                          {formatCredits(user.totalMoneySpent)}
                        </td>
                        <td className="p-2 text-right">
                          {formatCredits(user.avgCostPerCall)}
                        </td>
                        <td className="p-2 text-right">
                          <span className={user.currentCredits > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                            {formatCredits(user.currentCredits)}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {user.modelsUsed.slice(0, 3).map((model, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {model.split('/').pop()?.substring(0, 8)}...
                              </Badge>
                            ))}
                            {user.modelsUsed.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{user.modelsUsed.length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-gray-600">
                          {user.lastApiCall 
                            ? new Date(user.lastApiCall).toLocaleDateString()
                            : 'Never'
                          }
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUser(user)}
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          {stats && stats.topModels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Models by Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Model</th>
                        <th className="text-right p-2">API Calls</th>
                        <th className="text-right p-2">Total Tokens</th>
                        <th className="text-right p-2">Revenue</th>
                        <th className="text-right p-2">Avg Cost/Call</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topModels.map((model, index) => (
                        <tr key={model.modelId} className="border-b">
                          <td className="p-2 font-medium">{model.modelId}</td>
                          <td className="p-2 text-right">{model.apiCalls.toLocaleString()}</td>
                          <td className="p-2 text-right">{model.totalTokens.toLocaleString()}</td>
                          <td className="p-2 text-right text-green-600">
                            {formatCredits(model.revenue)}
                          </td>
                          <td className="p-2 text-right">
                            {formatCredits(model.revenue / model.apiCalls)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {stats && stats.topSpenders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Spenders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topSpenders.map((spender, index) => (
                    <div key={spender.userEmail} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <div className="font-medium">{spender.userName}</div>
                        <div className="text-sm text-gray-600">{spender.userEmail}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-red-600">
                          {formatCredits(spender.totalSpent)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {spender.apiCalls} calls
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedUser ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{selectedUser.userName} - Usage Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span>{selectedUser.userEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total API Calls:</span>
                      <span className="font-medium">{selectedUser.totalApiCalls.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Tokens:</span>
                      <span className="font-medium">{selectedUser.totalTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Money Spent:</span>
                      <span className="font-medium text-red-600">{formatCredits(selectedUser.totalMoneySpent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Credits:</span>
                      <span className={selectedUser.currentCredits > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                        {formatCredits(selectedUser.currentCredits)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Cost per Call:</span>
                      <span className="font-medium">{formatCredits(selectedUser.avgCostPerCall)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage by Model</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedUser.usageByModel.map((modelUsage, index) => (
                      <div key={index} className="p-2 border rounded">
                        <div className="font-medium text-sm">{modelUsage.modelId}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {modelUsage.apiCalls} calls • {modelUsage.totalTokens.toLocaleString()} tokens • {formatCredits(modelUsage.moneySpent)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-600">
                  Select a user from the "User Usage" tab to see detailed analytics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}