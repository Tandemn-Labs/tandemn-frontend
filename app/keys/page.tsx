'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye, EyeOff, Copy, Key, Plus } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

interface APIKey {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  isActive: boolean;
}

export default function APIKeysPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<{[keyId: string]: boolean}>({});

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchAPIKeys();
    }
  }, [isLoaded, isSignedIn]);

  const fetchAPIKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys || []);
      } else {
        console.error('Failed to fetch API keys:', response.status, await response.text());
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.apiKey) {
          setShowNewKey(data.apiKey.key);
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

  const deleteAPIKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/keys?keyId=${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchAPIKeys();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to delete API key');
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
    alert('API key copied to clipboard!');
  };

  const maskApiKey = (key: string) => {
    return `${key.substring(0, 12)}...${key.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isLoaded) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="mb-4">Please sign in to manage API keys.</p>
          <Link 
            href="/sign-in" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Keys</h1>
        <p className="text-muted-foreground">
          Generate API keys to access our services programmatically. Pricing is based on tokens consumed.
        </p>
      </div>

      {/* New Key Generation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generate New API Key
          </CardTitle>
          <CardDescription>
            Create a new API key for programmatic access. You can have up to 5 active keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Enter API key name (e.g., 'Production App', 'Testing')"
              value={newKeyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyName(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && generateAPIKey()}
              className="flex-1"
            />
            <Button 
              onClick={generateAPIKey} 
              disabled={!newKeyName.trim() || loading}
              className="shrink-0"
            >
              {loading ? 'Generating...' : 'Generate Key'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Show newly generated key */}
      {showNewKey && (
        <Card className="mb-6 border-green-400/30 bg-green-400/10 glass-card">
          <CardHeader>
            <CardTitle className="text-green-400">API Key Generated!</CardTitle>
            <CardDescription className="text-green-300/80">
              Copy this key now - it won&apos;t be shown again for security reasons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-background/80 rounded border border-border">
              <code className="flex-1 font-mono text-sm break-all text-foreground">{showNewKey}</code>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => copyToClipboard(showNewKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              className="mt-3" 
              variant="outline" 
              onClick={() => setShowNewKey(null)}
            >
              I&apos;ve copied the key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Standard API Call (~$0.10-0.50):</h4>
            <pre className="bg-muted/50 p-3 rounded text-sm overflow-x-auto border border-border text-foreground">
{`curl -X POST https://yourdomain.com/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "groq/gemma-groq-416",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
            </pre>
          </div>
        </CardContent>
      </Card> */}

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your API Keys ({apiKeys.length}/5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys yet. Generate your first one above.
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div 
                  key={key.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{key.name}</h3>
                      <Badge variant={key.isActive ? 'default' : 'secondary'}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <span>Key:</span>
                        <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono flex-1 text-foreground border border-border">
                          {visibleKeys[key.id] ? key.key : maskApiKey(key.key)}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleKeyVisibility(key.id)}
                          className="h-6 w-6 p-0"
                        >
                          {visibleKeys[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div>Created: {formatDate(key.createdAt)}</div>
                      {key.lastUsed && (
                        <div>Last used: {formatDate(key.lastUsed)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(key.key)}
                      title="Copy API key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteAPIKey(key.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete API key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}