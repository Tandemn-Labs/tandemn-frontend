'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

interface UserStats {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  modelUsage: Record<string, { tokens: number; requests: number; cost: number }>;
  lastActivity: number | null;
}

interface DailyStats {
  date: string;
  totalTokens: number;
  totalUsers: number;
  totalRequests: number;
}

interface AdminStats {
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalTokensProcessed: number;
    totalRequests: number;
    totalCost: number;
    period: string;
  };
  userStats: UserStats[];
  dailyStats: DailyStats[];
  generatedAt: string;
}

export default function AdminPage() {
  const { userId } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check admin status first
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/admin/setup');
        if (response.ok) {
          const data = await response.json();
          // This is a simple check - in production you'd want to verify the current user is admin
          setIsAdmin(true);
          fetchStats();
        } else {
          setError('Admin access required');
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to verify admin status');
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [userId]);

  const fetchStats = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin?days=${period}`);
      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required');
        } else {
          setError('Failed to fetch admin statistics');
        }
        return;
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError('Failed to load admin statistics');
      console.error('Admin stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    // Refetch data with new period
    setTimeout(fetchStats, 100);
  };

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Please sign in to access the admin dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading admin dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
            {!isAdmin && (
              <p className="text-sm text-gray-600 mt-2">
                Only administrators can access this page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>No statistics available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchStats} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.summary.activeUsers} active in {stats.summary.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.summary.totalTokensProcessed)}</div>
            <p className="text-xs text-muted-foreground">
              Tokens processed in {stats.summary.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.summary.totalRequests)}</div>
            <p className="text-xs text-muted-foreground">
              API requests in {stats.summary.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.summary.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              Revenue in {stats.summary.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg per User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats.summary.activeUsers > 0 ? 
                Math.round(stats.summary.totalTokensProcessed / stats.summary.activeUsers) : 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Tokens per active user
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">User Statistics</TabsTrigger>
          <TabsTrigger value="daily">Daily Trends</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Token Usage</CardTitle>
              <CardDescription>
                Token consumption by user for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.userStats.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.email}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {user.lastActivity 
                          ? `Last active: ${formatDate(new Date(user.lastActivity).toISOString())}` 
                          : 'No recent activity'}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="font-bold">{formatNumber(user.totalTokens)} tokens</div>
                      <div className="text-sm text-muted-foreground">
                        {user.requestCount} requests • {formatCurrency(user.totalCost)}
                      </div>
                      <div className="flex gap-1 justify-end">
                        {Object.entries(user.modelUsage).map(([modelId, usage]) => (
                          <Badge key={modelId} variant="secondary" className="text-xs">
                            {modelId.split('/').pop()}: {formatNumber(usage.tokens)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {stats.userStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No user activity found for the selected period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Trends</CardTitle>
              <CardDescription>
                Token consumption and user activity by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.dailyStats.map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-3 border rounded">
                    <div className="font-medium">{formatDate(day.date)}</div>
                    <div className="text-right">
                      <div className="font-bold">{formatNumber(day.totalTokens)} tokens</div>
                      <div className="text-sm text-muted-foreground">
                        {day.totalUsers} users • {day.totalRequests} requests
                      </div>
                    </div>
                  </div>
                ))}
                {stats.dailyStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No daily statistics available for the selected period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(stats.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}