'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UserStats {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  modelUsage: Record<string, { 
    inputTokens: number; 
    outputTokens: number; 
    totalTokens: number; 
    requests: number; 
    cost: number 
  }>;
  lastActivity: number | null;
  dailyUsage?: Record<string, {
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requests: number;
    cost: number;
    models: Record<string, { inputTokens: number; outputTokens: number; requests: number; cost: number }>;
  }>;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

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
      let url = '/api/admin';
      const params = new URLSearchParams();
      
      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else if (period !== 'custom') {
        params.append('days', period);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
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
    if (newPeriod !== 'custom') {
      setStartDate('');
      setEndDate('');
      // Refetch data with new period
      setTimeout(fetchStats, 100);
    }
  };

  const handleDateRangeSubmit = () => {
    if (startDate && endDate && new Date(startDate) <= new Date(endDate)) {
      setTimeout(fetchStats, 100);
    }
  };

  const setPresetDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
    setPeriod('custom');
    setTimeout(fetchStats, 100);
  };

  const handleUserClick = async (user: UserStats) => {
    setSelectedUser(user);
    setShowUserDetails(true);
    
    // Fetch detailed user data
    try {
      let url = `/api/admin/user/${user.userId}`;
      const params = new URLSearchParams();
      
      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else if (period !== 'custom') {
        params.append('days', period);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const detailData = await response.json();
        setSelectedUser({...user, dailyUsage: detailData.dailyUsage});
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (timestamp: number | string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom date range</SelectItem>
            </SelectContent>
          </Select>
          
          {period === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">From:</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">To:</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <Button 
                onClick={handleDateRangeSubmit} 
                size="sm"
                disabled={!startDate || !endDate || new Date(startDate) > new Date(endDate)}
              >
                Apply
              </Button>
            </div>
          )}
          
          {period === 'custom' && (
            <div className="flex items-center gap-1 ml-4">
              <span className="text-sm text-muted-foreground">Quick:</span>
              <Button onClick={() => setPresetDateRange(7)} variant="outline" size="sm">7d</Button>
              <Button onClick={() => setPresetDateRange(30)} variant="outline" size="sm">30d</Button>
              <Button onClick={() => setPresetDateRange(90)} variant="outline" size="sm">90d</Button>
            </div>
          )}
          
          <Button onClick={fetchStats} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
            <CardTitle className="text-sm font-medium">Input Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(stats.userStats.reduce((sum, user) => sum + user.totalInputTokens, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Input tokens in {stats.summary.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Output Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(stats.userStats.reduce((sum, user) => sum + user.totalOutputTokens, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Output tokens in {stats.summary.period}
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
                  <div 
                    key={user.userId} 
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleUserClick(user)}>
                    <div className="flex-1">
                      <div className="font-medium">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.email}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {user.lastActivity 
                          ? `Last active: ${formatDateTime(user.lastActivity)} EST` 
                          : 'No recent activity'}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="space-y-1">
                        <div className="font-bold">{formatNumber(user.totalTokens)} total tokens</div>
                        <div className="text-sm space-x-4">
                          <span className="text-blue-600">
                            ↑ {formatNumber(user.totalInputTokens)} in
                          </span>
                          <span className="text-green-600">
                            ↓ {formatNumber(user.totalOutputTokens)} out
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.requestCount} requests • {formatCurrency(user.totalCost)}
                      </div>
                      <div className="flex gap-1 justify-end flex-wrap">
                        {Object.entries(user.modelUsage).map(([modelId, usage]) => (
                          <Badge key={modelId} variant="secondary" className="text-xs">
                            {modelId.split('/').pop()}: 
                            <span className="text-blue-500 ml-1">{formatNumber(usage.inputTokens)}</span>
                            <span className="mx-1">/</span>
                            <span className="text-green-500">{formatNumber(usage.outputTokens)}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {stats.userStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No user activity found for the selected period.</p>
                    <p className="text-sm mt-2">
                      Period: {stats.summary.period}
                    </p>
                    <p className="text-sm">
                      Try selecting "Last 30 days" or a broader date range.
                    </p>
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
                    <div className="font-medium">{formatDate(day.date)} EST</div>
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
        Last updated: {new Date(stats.generatedAt).toLocaleString('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })} EST
      </div>

      {/* User Details Modal */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.firstName && selectedUser?.lastName 
                ? `${selectedUser.firstName} ${selectedUser.lastName}` 
                : selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              Daily token usage breakdown for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{formatNumber(selectedUser.totalTokens)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Input Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-blue-600">{formatNumber(selectedUser.totalInputTokens)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Output Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-green-600">{formatNumber(selectedUser.totalOutputTokens)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{formatCurrency(selectedUser.totalCost)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Daily Usage Breakdown</h3>
                <div className="space-y-3">
                  {selectedUser.dailyUsage ? (
                    Object.values(selectedUser.dailyUsage)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((day) => (
                        <Card key={day.date}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{formatDate(day.date)} EST</h4>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {day.requests} requests
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">{formatNumber(day.totalTokens)} total tokens</div>
                                <div className="text-sm space-x-2">
                                  <span className="text-blue-600">↑ {formatNumber(day.inputTokens)}</span>
                                  <span className="text-green-600">↓ {formatNumber(day.outputTokens)}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">{formatCurrency(day.cost)}</div>
                              </div>
                            </div>
                            
                            {/* Model breakdown for the day */}
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {Object.entries(day.models).map(([modelId, usage]) => (
                                <Badge key={modelId} variant="secondary" className="text-xs">
                                  {modelId.split('/').pop()}: 
                                  <span className="text-blue-500 ml-1">{formatNumber(usage.inputTokens)}</span>
                                  <span className="mx-1">/</span>
                                  <span className="text-green-500">{formatNumber(usage.outputTokens)}</span>
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading daily breakdown...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}