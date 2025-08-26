'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

interface LoadTestResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  statusCode: number;
  responseTime: number;
  content?: string;
  machineNumber?: number;
  model?: string;
  error?: string;
}

interface TestStats {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  avgResponseTime: number;
  machineDistribution: Record<string, number>;
  processingMode: Record<string, number>;
}

interface Machine {
  id: string;
  machineNumber: number;
  modelId: string;
  status: 'healthy' | 'unhealthy' | 'offline';
  load: string;
  responseTime: string;
  endpoint: string;
  totalRequests: number;
  errorCount: number;
  lastHealthCheck: string;
}

export default function LoadTestPage() {
  const [concurrentUsers, setConcurrentUsers] = useState(10);
  const [totalRequests, setTotalRequests] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<LoadTestResult[]>([]);
  const [stats, setStats] = useState<TestStats>({
    total: 0,
    completed: 0,
    successful: 0,
    failed: 0,
    avgResponseTime: 0,
    machineDistribution: {},
    processingMode: {}
  });
  const [gatewayHealth, setGatewayHealth] = useState<any>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineRefreshInterval, setMachineRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch gateway health and machines on load
  useEffect(() => {
    fetchGatewayHealth();
    fetchMachines();
    
    // Set up auto-refresh for machines every 2 seconds
    const interval = setInterval(() => {
      fetchMachines();
    }, 2000);
    
    setMachineRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const fetchGatewayHealth = async () => {
    try {
      const response = await fetch('/api/gateway/health');
      const data = await response.json();
      setGatewayHealth(data);
    } catch (error) {
      console.error('Failed to fetch gateway health:', error);
    }
  };

  const fetchMachines = async () => {
    try {
      const response = await fetch('/api/gateway/machines');
      const data = await response.json();
      if (data.machines) {
        setMachines(data.machines);
      }
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    }
  };

  const toggleMachine = async (machineId: string, isCurrentlyOn: boolean) => {
    try {
      const action = isCurrentlyOn ? 'stop' : 'start';
      const response = await fetch('/api/gateway/machines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineId,
          action
        })
      });

      if (response.ok) {
        // Immediately refresh machines to show the change
        fetchMachines();
      } else {
        console.error('Failed to toggle machine');
      }
    } catch (error) {
      console.error('Error toggling machine:', error);
    }
  };

  const runLoadTest = async () => {
    setIsRunning(true);
    setResults([]);
    setStats({
      total: totalRequests,
      completed: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0,
      machineDistribution: {},
      processingMode: {}
    });

    // Initialize results array
    const initialResults: LoadTestResult[] = Array.from({ length: totalRequests }, (_, i) => ({
      id: `test-${i}`,
      status: 'pending',
      statusCode: 0,
      responseTime: 0
    }));
    setResults(initialResults);

    // Get models from the API
    let models = [
      'groq/gemma-groq-416',
      'anthropic/claude-3-5-sonnet-260',
      'google/gemini-2-0-pro-130',
      'openai/gpt-4-451',
      'perplexity/perplexity-70b-73'
    ];
    
    // Try to get actual models from API (fallback to hardcoded if fails)
    try {
      const modelsResponse = await fetch('/api/models');
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        if (modelsData.items && modelsData.items.length > 0) {
          models = modelsData.items.slice(0, 5).map((m: any) => m.id);
        }
      }
    } catch (error) {
      console.log('Using fallback models:', error);
    }

    // Create requests in batches to handle concurrency vs total requests
    const requestsPerBatch = Math.ceil(totalRequests / concurrentUsers);
    const allPromises: Promise<LoadTestResult>[] = [];
    
    // Process requests in concurrent batches
    for (let batch = 0; batch < concurrentUsers; batch++) {
      const batchPromises = [];
      const startIdx = batch * requestsPerBatch;
      const endIdx = Math.min(startIdx + requestsPerBatch, totalRequests);
      
      for (let reqIdx = startIdx; reqIdx < endIdx; reqIdx++) {
        batchPromises.push(processRequest(reqIdx, models));
      }
      
      // Add batch promises to the main promise array
      allPromises.push(...batchPromises);
    }

    async function processRequest(index: number, models: string[]): Promise<LoadTestResult> {
      const model = models[Math.floor(Math.random() * models.length)];
      const startTime = performance.now();
      
      // Update status to running
      setResults(prev => prev.map(r => 
        r.id === `test-${index}` 
          ? { ...r, status: 'running', model }
          : r
      ));

      try {
        const response = await fetch('/api/v1/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer gk-loadtest_12345678901234567890'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: `Hello from user ${index + 1}! This is a load test.`
              }
            ],
            max_tokens: 50
          })
        });

        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        const data = await response.json();

        let content = '';
        let machineNumber;
        let processingMode = 'unknown';

        if (response.ok && data.choices) {
          content = data.choices[0]?.message?.content || '';
          machineNumber = data.instance_info?.machine_number || data.gateway?.machine_number;
          processingMode = data.processing_mode || 'direct';
        }

        const result: LoadTestResult = {
          id: `test-${index}`,
          status: response.ok ? 'completed' : 'error',
          statusCode: response.status,
          responseTime,
          content,
          machineNumber,
          model,
          error: !response.ok ? data.error : undefined
        };

        // Update individual result
        setResults(prev => prev.map(r => 
          r.id === `test-${index}` ? result : r
        ));

        return result;
      } catch (error) {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        const result: LoadTestResult = {
          id: `test-${index}`,
          status: 'error',
          statusCode: 0,
          responseTime,
          model,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        setResults(prev => prev.map(r => 
          r.id === `test-${index}` ? result : r
        ));

        return result;
      }
    }

    // Execute requests with controlled concurrency
    const finalResults: LoadTestResult[] = [];
    for (let i = 0; i < allPromises.length; i += concurrentUsers) {
      const batch = allPromises.slice(i, i + concurrentUsers);
      const batchResults = await Promise.all(batch);
      finalResults.push(...batchResults);
    }
    
    // Calculate final stats
    const successful = finalResults.filter(r => r.status === 'completed').length;
    const failed = finalResults.filter(r => r.status === 'error').length;
    const totalResponseTime = finalResults.reduce((sum, r) => sum + r.responseTime, 0);
    const avgResponseTime = Math.round(totalResponseTime / finalResults.length);

    const machineDistribution: Record<string, number> = {};
    const processingMode: Record<string, number> = {};

    finalResults.forEach(r => {
      if (r.machineNumber) {
        const machine = `Machine ${r.machineNumber}`;
        machineDistribution[machine] = (machineDistribution[machine] || 0) + 1;
      }
      
      // Count processing modes from responses
      if (r.content && r.content.includes('Machine')) {
        processingMode['gateway'] = (processingMode['gateway'] || 0) + 1;
      } else if (r.error) {
        processingMode['error'] = (processingMode['error'] || 0) + 1;
      } else {
        processingMode['direct'] = (processingMode['direct'] || 0) + 1;
      }
    });

    setStats({
      total: totalRequests,
      completed: successful + failed,
      successful,
      failed,
      avgResponseTime,
      machineDistribution,
      processingMode
    });

    setIsRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-500';
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Gateway Load Test</h1>
          <p className="text-muted-foreground">
            Test the API gateway with concurrent requests and see real-time results
          </p>
        </div>
        <Button onClick={fetchGatewayHealth} variant="outline">
          Refresh Health
        </Button>
      </div>

      {/* Gateway Health */}
      {gatewayHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Gateway Health
              <Badge variant={gatewayHealth.healthy ? "default" : "destructive"}>
                {gatewayHealth.healthy ? "Healthy" : "Unhealthy"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Redis</Label>
                <p className={`font-semibold ${gatewayHealth.checks.redis ? 'text-green-600' : 'text-red-600'}`}>
                  {gatewayHealth.checks.redis ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Total Instances</Label>
                <p className="font-semibold">{gatewayHealth.checks.instances.total}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Healthy Instances</Label>
                <p className="font-semibold text-green-600">{gatewayHealth.checks.instances.healthy}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Last Check</Label>
                <p className="text-sm">{new Date(gatewayHealth.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Machine Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Machine Control Panel
            <Badge variant="outline">{machines.filter(m => m.status === 'healthy').length}/{machines.length} Online</Badge>
          </CardTitle>
          <CardDescription>
            Control individual machines and see real-time load balancing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map((machine) => (
              <div 
                key={machine.id}
                className={`p-4 border rounded-lg transition-all ${
                  machine.status === 'healthy' ? 'bg-green-50 border-green-200' : 
                  machine.status === 'offline' ? 'bg-gray-50 border-gray-200' : 
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      machine.status === 'healthy' ? 'bg-green-500' : 
                      machine.status === 'offline' ? 'bg-gray-500' : 
                      'bg-red-500'
                    }`} />
                    <span className="font-semibold">Machine {machine.machineNumber}</span>
                  </div>
                  <Switch
                    checked={machine.status === 'healthy'}
                    onCheckedChange={() => toggleMachine(machine.id, machine.status === 'healthy')}
                  />
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono text-xs">{machine.modelId.split('/')[1]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Load:</span>
                    <span>{machine.load}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response:</span>
                    <span>{machine.responseTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requests:</span>
                    <span>{machine.totalRequests}</span>
                  </div>
                  {machine.errorCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="text-red-600">{machine.errorCount}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Load Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Load Test Configuration</CardTitle>
          <CardDescription>
            Configure and run concurrent API requests to test the gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="users">Concurrent Users</Label>
              <Input
                id="users"
                type="number"
                min="1"
                max="1000"
                value={concurrentUsers}
                onChange={(e) => setConcurrentUsers(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground mt-1">Number of simultaneous requests</p>
            </div>
            <div>
              <Label htmlFor="total">Total Requests</Label>
              <Input
                id="total"
                type="number"
                min="1"
                max="10000"
                value={totalRequests}
                onChange={(e) => setTotalRequests(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground mt-1">Total requests to execute</p>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={runLoadTest} 
                disabled={isRunning}
                className="w-full"
              >
                {isRunning ? 'Running...' : 'Start Test'}
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
            <strong>Test Configuration:</strong> {totalRequests} requests will be executed with {concurrentUsers} concurrent connections. 
            Each batch processes up to {Math.ceil(totalRequests / concurrentUsers)} requests per user.
          </div>
        </CardContent>
      </Card>

      {/* Test Statistics */}
      {stats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>Real-time statistics from the load test</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Total</Label>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Completed</Label>
                  <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Successful</Label>
                  <p className="text-2xl font-bold text-green-600">{stats.successful}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Failed</Label>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Avg Response Time</Label>
                  <p className="text-2xl font-bold">{stats.avgResponseTime}ms</p>
                </div>
              </div>

              <Progress 
                value={(stats.completed / stats.total) * 100} 
                className="w-full"
              />

              {/* Machine Distribution */}
              {Object.keys(stats.machineDistribution).length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Machine Distribution</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(stats.machineDistribution).map(([machine, count]) => (
                      <Badge key={machine} variant="secondary">
                        {machine}: {count} requests
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Mode Distribution */}
              {Object.keys(stats.processingMode).length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Processing Mode</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(stats.processingMode).map(([mode, count]) => (
                      <Badge key={mode} variant="outline">
                        {mode}: {count} requests
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Results Grid */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Individual Request Results</CardTitle>
            <CardDescription>Status of each concurrent request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`
                    p-2 rounded text-xs text-white text-center cursor-pointer
                    ${getStatusColor(result.status)}
                  `}
                  title={`
                    Status: ${result.status}
                    ${result.statusCode ? `Code: ${result.statusCode}` : ''}
                    ${result.responseTime ? `Time: ${result.responseTime}ms` : ''}
                    ${result.model ? `Model: ${result.model}` : ''}
                    ${result.content ? `Response: ${result.content.substring(0, 100)}` : ''}
                    ${result.error ? `Error: ${result.error}` : ''}
                  `}
                >
                  {result.id.split('-')[1]}
                  {result.machineNumber && (
                    <div className="text-xs opacity-75">M{result.machineNumber}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-4">
                <span><span className="inline-block w-3 h-3 bg-gray-500 rounded mr-1"></span>Pending</span>
                <span><span className="inline-block w-3 h-3 bg-blue-500 rounded mr-1"></span>Running</span>
                <span><span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>Success</span>
                <span><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span>Error</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Responses */}
      {results.filter(r => r.content).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sample Responses</CardTitle>
            <CardDescription>First few successful responses from the gateway</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results
                .filter(r => r.content)
                .slice(0, 10)
                .map((result) => (
                  <div key={result.id} className="p-3 bg-muted rounded text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">{result.model}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {result.responseTime}ms
                        {result.machineNumber && ` • Machine ${result.machineNumber}`}
                      </span>
                    </div>
                    <p className="text-sm">{result.content}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}