'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCredits, formatCurrency } from '@/lib/credits-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UserStats {
  id: string;
  email: string;
  name: string;
  credits: number;
  totalTransactions: number;
  lastActivity: string;
  joinedAt: string;
  isAdmin: boolean;
  totalSpent: number;
  totalEarned: number;
}

interface AdminStats {
  totalUsers: number;
  totalCredits: number;
  totalRevenue: number;
  avgCreditsPerUser: number;
  activeUsers: number;
}

export default function AdminStatsPage() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }
      
      setUsers(data.users);
      setAdminStats(data.adminStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedUserId || !creditAmount) return;
    
    try {
      const response = await fetch('/api/admin/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          amount: parseFloat(creditAmount)
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add credits');
      }
      
      // Refresh stats after adding credits
      await fetchStats();
      setCreditAmount('');
      setSelectedUserId(null);
      alert('Credits added successfully!');
    } catch (err) {
      alert('Failed to add credits: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading admin stats...</p>
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
              <p className="text-xl font-semibold">Access Denied</p>
              <p className="mt-2">{error}</p>
              <p className="mt-2 text-sm text-gray-600">Only admins can access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard - Credit Statistics</h1>
        <Button onClick={fetchStats} variant="outline">
          Refresh
        </Button>
      </div>

      {adminStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credits in System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCredits(adminStats.totalCredits)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(adminStats.totalRevenue)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Credits per User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCredits(adminStats.avgCreditsPerUser)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="credits">Add Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Credit Statistics ({filteredUsers.length} users)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-right p-2">Current Credits</th>
                      <th className="text-right p-2">Total Spent</th>
                      <th className="text-right p-2">Total Earned</th>
                      <th className="text-center p-2">Transactions</th>
                      <th className="text-center p-2">Status</th>
                      <th className="text-left p-2">Last Activity</th>
                      <th className="text-left p-2">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{user.name}</span>
                            {user.isAdmin && (
                              <Badge variant="destructive" className="text-xs">Admin</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-gray-600">{user.email}</td>
                        <td className="p-2 text-right font-medium">
                          <span className={user.credits > 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCredits(user.credits)}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          {formatCredits(user.totalSpent)}
                        </td>
                        <td className="p-2 text-right">
                          {formatCredits(user.totalEarned)}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline">{user.totalTransactions}</Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={user.credits > 0 ? 'default' : 'secondary'}>
                            {user.credits > 0 ? 'Active' : 'No Credits'}
                          </Badge>
                        </td>
                        <td className="p-2 text-sm text-gray-600">
                          {user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-2 text-sm text-gray-600">
                          {new Date(user.joinedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Credits to User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium">Select User</label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="">Choose a user...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email}) - Current: {formatCredits(user.credits)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Credit Amount ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter credit amount"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={handleAddCredits}
                  disabled={!selectedUserId || !creditAmount}
                  className="w-full"
                >
                  Add Credits
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}