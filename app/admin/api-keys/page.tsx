'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCredits } from '@/lib/credits-client';

interface ApiKeyInfo {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  isActive: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userCredits: number;
}

interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  keysUsedToday: number;
  keysUsedThisWeek: number;
  totalUsers: number;
}

export default function AdminApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/api-keys');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch API keys');
      }
      
      setApiKeys(data.apiKeys);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateKey = async (userId: string, keyId: string) => {
    if (!confirm('Are you sure you want to deactivate this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/api-keys/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, keyId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to deactivate API key');
      }
      
      await fetchApiKeys();
      alert('API key deactivated successfully!');
    } catch (err) {
      alert('Failed to deactivate API key: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const filteredKeys = apiKeys.filter(key => 
    key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    key.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    key.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    key.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading API keys...</p>
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
        <h1 className="text-3xl font-bold">API Keys Management</h1>
        <Button onClick={fetchApiKeys} variant="outline">
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalKeys}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeKeys}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.inactiveKeys}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Used This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.keysUsedThisWeek}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users with Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search by key name, user email, or key value..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All API Keys ({filteredKeys.length} keys)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Key Name</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">API Key (Partial)</th>
                  <th className="text-right p-2">User Credits</th>
                  <th className="text-center p-2">Status</th>
                  <th className="text-left p-2">Last Used</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((apiKey) => (
                  <tr key={`${apiKey.userId}-${apiKey.id}`} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{apiKey.name}</td>
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{apiKey.userName}</div>
                        <div className="text-sm text-gray-600">{apiKey.userEmail}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {apiKey.key.substring(0, 20)}...
                      </code>
                    </td>
                    <td className="p-2 text-right">
                      <span className={apiKey.userCredits > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCredits(apiKey.userCredits)}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                        {apiKey.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {apiKey.lastUsed 
                        ? new Date(apiKey.lastUsed).toLocaleString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-center">
                      {apiKey.isActive && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeactivateKey(apiKey.userId, apiKey.id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}