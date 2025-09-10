'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Eye, Key, Zap, Brain, Code, MessageSquare, Plus, ExternalLink } from 'lucide-react';
import { TandemnModel } from '@/config/models';

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  isActive: boolean;
}

export default function ModelsPage() {
  const { isSignedIn } = useUser();
  const [models, setModels] = useState<TandemnModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<TandemnModel | null>(null);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchModels();
    if (isSignedIn) {
      fetchAPIKeys();
    }
  }, [isSignedIn]);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/v1/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data.data || []);
        if (data.data && data.data.length > 0) {
          setSelectedModel(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchAPIKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys || []);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const generateAPIKey = async () => {
    if (!newKeyName.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.apiKey) {
          setGeneratedKey(data.apiKey.key);
          setNewKeyName('');
          await fetchAPIKeys();
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to generate API key');
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      alert('Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple feedback - in production you'd use a toast
    const button = document.activeElement as HTMLButtonElement;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      if (button.textContent === 'Copied!') {
        button.textContent = originalText;
      }
    }, 2000);
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getApiKeyPrefix = () => {
    return apiKeys.length > 0 ? apiKeys[0].key : 'YOUR_API_KEY';
  };

  const getApiDomain = () => {
    if (typeof window !== 'undefined') {
      // Client side - use current domain
      return window.location.origin;
    }
    // Server side or fallback - use production domain
    return 'https://tandemn-frontend.vercel.app';
  };

  const generateCurlExample = (model: TandemnModel) => {
    const apiKey = getApiKeyPrefix();
    const domain = getApiDomain();
    return `curl -X POST ${domain}/api/v1/chat/complete \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.id}",
    "messages": [
      {"role": "user", "content": "Hello! Can you explain quantum computing?"}
    ]
  }'`;
  };

  const generatePythonExample = (model: TandemnModel) => {
    const apiKey = getApiKeyPrefix();
    const domain = getApiDomain();
    return `import requests

url = "${domain}/api/v1/chat/complete"
headers = {
    "Authorization": f"Bearer ${apiKey}",
    "Content-Type": "application/json"
}
data = {
    "model": "${model.id}",
    "messages": [
        {"role": "user", "content": "Hello! Can you explain quantum computing?"}
    ]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;
  };

  const generateNodeExample = (model: TandemnModel) => {
    const apiKey = getApiKeyPrefix();
    const domain = getApiDomain();
    return `const fetch = require('node-fetch');

const response = await fetch('${domain}/api/v1/chat/complete', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: '${model.id}',
    messages: [
      { role: 'user', content: 'Hello! Can you explain quantum computing?' }
    ]
  })
});

const data = await response.json();
console.log(data);`;
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Models</h1>
        <p className="text-white dark:text-white">
          Choose from our available models and get started with API integration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Models List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Available Models
              </CardTitle>
              <CardDescription className="text-black dark:text-white">
                Select a model to view details and integration examples
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedModel?.id === model.id
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/50'
                      : 'border-border hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedModel(model)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{model.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {model.provider}
                      </Badge>
                    </div>
                    <p className="text-xs text-white dark:text-white line-clamp-2">
                      {model.description}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-black dark:text-white">
                        {formatNumber(model.context_length)} context
                      </span>
                      <span className="text-black dark:text-white">
                        {formatPrice(model.input_price_per_1m)}/1M tokens
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {model.capabilities.slice(0, 3).map((capability) => (
                        <Badge key={capability} variant="outline" className="text-xs">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Model Details and API Integration */}
        <div className="lg:col-span-2">
          {selectedModel ? (
            <div className="space-y-6">
              {/* Model Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        {selectedModel.name}
                      </CardTitle>
                      <CardDescription className="text-white dark:text-white">{selectedModel.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">{selectedModel.provider}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Context Length</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatNumber(selectedModel.context_length)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Input Price</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPrice(selectedModel.input_price_per_1m)}
                      </p>
                      <p className="text-xs text-black dark:text-white">per 1M tokens</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Output Price</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPrice(selectedModel.output_price_per_1m)}
                      </p>
                      <p className="text-xs text-black dark:text-white">per 1M tokens</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Max Tokens</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatNumber(selectedModel.max_tokens)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Capabilities</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    API Integration
                  </CardTitle>
                  <CardDescription>
                    Get started with {selectedModel.name} using your API key
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* API Key Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        API Key Required
                      </h3>
                      {isSignedIn && (
                        <Button
                          onClick={() => setShowApiKeyDialog(true)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          {apiKeys.length > 0 ? 'Manage Keys' : 'Generate Key'}
                        </Button>
                      )}
                    </div>

                    {!isSignedIn ? (
                      <div className="p-4 border-2 border-dashed border-border rounded-lg text-center">
                        <p className="text-black dark:text-white mb-4">
                          Sign in to generate and manage your API keys
                        </p>
                        <Link href="/sign-in">
                          <Button>Sign In</Button>
                        </Link>
                      </div>
                    ) : apiKeys.length === 0 ? (
                      <div className="p-4 border-2 border-dashed border-border rounded-lg text-center">
                        <p className="text-black dark:text-white mb-4">
                          Generate your first API key to get started
                        </p>
                        <Button onClick={() => setShowApiKeyDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Generate API Key
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Using API Key</p>
                            <code className="text-xs text-foreground font-mono">
                              {apiKeys[0].key.substring(0, 12)}...{apiKeys[0].key.slice(-4)}
                            </code>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowApiKeyDialog(true)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Code Examples */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Code Examples</h3>
                    <Tabs defaultValue="curl" className="space-y-4">
                      <TabsList>
                        <TabsTrigger value="curl">cURL</TabsTrigger>
                        <TabsTrigger value="python">Python</TabsTrigger>
                        <TabsTrigger value="node">Node.js</TabsTrigger>
                      </TabsList>

                      <TabsContent value="curl" className="space-y-2">
                        <div className="relative">
                          <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-x-auto border">
                            <code className="text-foreground font-mono">{generateCurlExample(selectedModel)}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(generateCurlExample(selectedModel))}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="python" className="space-y-2">
                        <div className="relative">
                          <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-x-auto border">
                            <code className="text-foreground font-mono">{generatePythonExample(selectedModel)}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(generatePythonExample(selectedModel))}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="node" className="space-y-2">
                        <div className="relative">
                          <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-x-auto border">
                            <code className="text-foreground font-mono">{generateNodeExample(selectedModel)}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(generateNodeExample(selectedModel))}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Documentation Links */}
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-3">Documentation</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <Link href="/credits" className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <Zap className="h-4 w-4" />
                        <div>
                          <p className="font-medium text-sm">Credits & Billing</p>
                          <p className="text-xs text-black dark:text-white">Manage your usage and billing</p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-auto" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-black dark:text-white">Select a model to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Management</DialogTitle>
            <DialogDescription>
              Generate and manage your API keys for accessing Tandemn models
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  API Key Generated Successfully!
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  Copy this key now - it won't be shown again for security reasons.
                </p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded border">
                  <code className="flex-1 text-sm font-mono break-all text-foreground">{generatedKey}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setGeneratedKey(null);
                  setShowApiKeyDialog(false);
                }}>
                  Close
                </Button>
                <Button onClick={() => setGeneratedKey(null)}>
                  Generate Another Key
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Your API Keys ({apiKeys.length}/5)</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">{key.name}</p>
                          <code className="text-xs text-foreground font-mono">
                            {key.key.substring(0, 12)}...{key.key.slice(-4)}
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(key.key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {apiKeys.length < 5 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Generate New API Key</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter key name (e.g., 'Production')"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generateAPIKey()}
                      />
                      <Button
                        onClick={generateAPIKey}
                        disabled={!newKeyName.trim() || loading}
                      >
                        {loading ? 'Generating...' : 'Generate'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Link href="/keys">
                  <Button variant="outline">Manage All Keys</Button>
                </Link>
                <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}