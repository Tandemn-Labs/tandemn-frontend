'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, DollarSign, MessageSquare, Clock } from 'lucide-react';

interface MetricsData {
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageProcessingTime: number;
    // Backend information hidden from user metrics
    requestsByModel: Array<{
      modelId: string;
      count: number;
      totalTokens: number;
      totalCost: number;
    }>;
    dailyStats: Array<{
      date: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
  };
  recentResponses: Array<{
    _id: string;
    userId: string;
    modelId: string;
    inputText: string;
    responseText: string;
    // backendUsed: string; // Hidden from user view
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    processingTimeMs: number;
    timestamp: string;
  }>;
}

// Color constants removed - no longer needed

export default function MetricsPage() {
  const { user, isSignedIn } = useUser();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    modelId: '',
    // backendUsed: '', // Hidden from user
    startDate: '',
    endDate: '',
  });

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.modelId) params.append('modelId', filters.modelId);
      // Backend filter removed from user interface
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/metrics?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      fetchMetrics();
    }
  }, [isSignedIn, filters]); // Backend filters removed from user interface

  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Metrics Dashboard</h1>
          <p className="text-muted-foreground">Please sign in to view metrics.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Metrics Dashboard</h1>
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Metrics Dashboard</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchMetrics}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Metrics Dashboard</h1>
          <p className="text-muted-foreground">No metrics data available.</p>
        </div>
      </div>
    );
  }

  // Backend data removed from user view

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Metrics Dashboard</h1>
        <Button onClick={fetchMetrics} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Model</label>
              <Input
                placeholder="Filter by model"
                value={filters.modelId}
                onChange={(e) => setFilters({ ...filters, modelId: e.target.value })}
              />
            </div>
            {/* Backend filter removed from user interface */}
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.summary.totalCost.toFixed(4)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.summary.averageProcessingTime)}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-8 mb-8">
        {/* Backend Distribution - Removed from user view */}
        
        {/* Daily Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.summary.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Models Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Top Models by Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.summary.requestsByModel}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="modelId" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Model Breakdown List */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Model Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.summary.requestsByModel.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Model</th>
                      <th className="text-right py-2 font-medium">Requests</th>
                      <th className="text-right py-2 font-medium">Total Tokens</th>
                      <th className="text-right py-2 font-medium">Total Cost</th>
                      <th className="text-right py-2 font-medium">Avg Cost/Request</th>
                      <th className="text-right py-2 font-medium">Usage %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.summary.requestsByModel.map((model, index) => {
                      const usagePercentage = metrics.summary.totalRequests > 0 
                        ? ((model.count / metrics.summary.totalRequests) * 100).toFixed(1)
                        : '0.0';
                      const avgCostPerRequest = model.count > 0 
                        ? (model.totalCost / model.count).toFixed(4)
                        : '0.0000';
                      
                      return (
                        <tr key={model.modelId} className="border-b hover:bg-muted/50">
                          <td className="py-3">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {model.modelId.split('/')[0]}
                              </Badge>
                              <span className="font-medium">{model.modelId}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 font-mono">
                            {model.count.toLocaleString()}
                          </td>
                          <td className="text-right py-3 font-mono">
                            {model.totalTokens.toLocaleString()}
                          </td>
                          <td className="text-right py-3 font-mono">
                            ${model.totalCost.toFixed(4)}
                          </td>
                          <td className="text-right py-3 font-mono">
                            ${avgCostPerRequest}
                          </td>
                          <td className="text-right py-3">
                            <div className="flex items-center justify-end space-x-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full" 
                                  style={{ width: `${usagePercentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8">
                                {usagePercentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="py-3">Total</td>
                      <td className="text-right py-3 font-mono">
                        {metrics.summary.totalRequests.toLocaleString()}
                      </td>
                      <td className="text-right py-3 font-mono">
                        {metrics.summary.totalTokens.toLocaleString()}
                      </td>
                      <td className="text-right py-3 font-mono">
                        ${metrics.summary.totalCost.toFixed(4)}
                      </td>
                      <td className="text-right py-3 font-mono">
                        ${metrics.summary.totalRequests > 0 
                          ? (metrics.summary.totalCost / metrics.summary.totalRequests).toFixed(4)
                          : '0.0000'
                        }
                      </td>
                      <td className="text-right py-3">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No model usage data available yet.</p>
                <p className="text-sm">Start chatting to see model breakdown statistics.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.recentResponses.map((response) => (
              <div key={response._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{response.modelId}</Badge>
                    {/* Backend badge removed from user view */}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(response.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm mb-2">
                  <strong>Input:</strong> {response.inputText.substring(0, 100)}...
                </div>
                <div className="text-sm mb-2">
                  <strong>Response:</strong> {response.responseText.substring(0, 100)}...
                </div>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <span>Tokens: {response.totalTokens}</span>
                  <span>Cost: ${response.totalCost.toFixed(4)}</span>
                  <span>Time: {response.processingTimeMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
