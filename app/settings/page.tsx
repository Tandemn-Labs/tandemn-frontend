'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings as SettingsIcon, 
  Activity, 
  Download, 
  Trash2, 
  RefreshCw,
  Clock,
  User,
  Zap
} from 'lucide-react';

interface RawEvent {
  id: string;
  timestamp: string;
  type: 'message_sent' | 'model_switched' | 'room_created' | 'credit_used' | 'inference_started' | 'inference_completed';
  userId: string;
  data: {
    modelId?: string;
    modelName?: string;
    tokens?: number;
    cost?: number;
    roomId?: string;
    messageId?: string;
    content?: string;
    duration?: number;
    [key: string]: any;
  };
}

export default function SettingsPage() {
  const { user, isSignedIn } = useUser();
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Generate mock raw events for demonstration
  const generateMockEvents = (): RawEvent[] => {
    const eventTypes: RawEvent['type'][] = [
      'message_sent', 'model_switched', 'room_created', 'credit_used', 
      'inference_started', 'inference_completed'
    ];
    
    const models = [
      'claude-4-sonnet', 'gpt-4o', 'gemini-2.0-pro', 'llama-3.1-405b'
    ];

    const events: RawEvent[] = [];
    const now = Date.now();
    
    for (let i = 0; i < 50; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const modelName = models[Math.floor(Math.random() * models.length)];
      const timestamp = new Date(now - (i * Math.random() * 24 * 60 * 60 * 1000)).toISOString();
      
      const baseEvent: RawEvent = {
        id: `evt_${Date.now()}_${i}`,
        timestamp,
        type: eventType,
        userId: user?.id || 'demo-user',
        data: {}
      };

      switch (eventType) {
        case 'message_sent':
          baseEvent.data = {
            modelId: modelName,
            modelName: modelName.toUpperCase(),
            roomId: `room_${Math.floor(Math.random() * 10)}`,
            messageId: `msg_${Date.now()}_${i}`,
            content: 'User message content...',
            tokens: Math.floor(Math.random() * 2000 + 500)
          };
          break;
        case 'inference_started':
          baseEvent.data = {
            modelId: modelName,
            modelName: modelName.toUpperCase(),
            tokens: Math.floor(Math.random() * 5000 + 1000)
          };
          break;
        case 'inference_completed':
          baseEvent.data = {
            modelId: modelName,
            modelName: modelName.toUpperCase(),
            tokens: Math.floor(Math.random() * 5000 + 1000),
            duration: Math.floor(Math.random() * 3000 + 500),
            cost: Math.random() * 0.1 + 0.01
          };
          break;
        case 'credit_used':
          baseEvent.data = {
            modelId: modelName,
            modelName: modelName.toUpperCase(),
            cost: Math.random() * 0.1 + 0.01,
            tokens: Math.floor(Math.random() * 2000 + 500)
          };
          break;
        case 'model_switched':
          baseEvent.data = {
            fromModel: models[Math.floor(Math.random() * models.length)],
            toModel: modelName,
            roomId: `room_${Math.floor(Math.random() * 10)}`
          };
          break;
        case 'room_created':
          baseEvent.data = {
            roomId: `room_${Date.now()}_${i}`,
            modelId: modelName,
            title: 'New conversation'
          };
          break;
      }
      
      events.push(baseEvent);
    }
    
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  useEffect(() => {
    // Simulate loading raw events
    const loadEvents = () => {
      setIsLoading(true);
      setTimeout(() => {
        setRawEvents(generateMockEvents());
        setIsLoading(false);
      }, 500);
    };

    loadEvents();
    
    // Auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(loadEvents, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, user]);

  const exportEvents = () => {
    const dataStr = JSON.stringify(rawEvents, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `raw-events-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearEvents = () => {
    setRawEvents([]);
  };

  const getEventTypeColor = (type: RawEvent['type']) => {
    switch (type) {
      case 'message_sent': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'inference_started': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'inference_completed': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'credit_used': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'model_switched': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'room_created': return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit', 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 md:h-8 md:w-8" />
            Settings
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Manage your account settings and view raw system events
          </p>
        </div>
      </div>

      <Tabs defaultValue="events" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events" className="text-xs md:text-sm">Raw Events</TabsTrigger>
          <TabsTrigger value="account" className="text-xs md:text-sm">Account</TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs md:text-sm">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    All Raw Events
                  </CardTitle>
                  <CardDescription>
                    Real-time system events and user activity logs
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`${autoRefresh ? "bg-green-50 text-green-700" : ""} text-xs md:text-sm`}
                  >
                    <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                    Auto Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportEvents} className="text-xs md:text-sm">
                    <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearEvents} className="text-xs md:text-sm">
                    <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-4">
                    <div className="font-medium">DATE</div>
                    <div className="font-medium">USER</div>
                    <div className="font-medium">KIND</div>
                    <div className="font-medium">MODEL</div>
                    <div className="font-medium">TOKENS</div>
                    <div className="font-medium">COST</div>
                  </div>
                </div>
                
                {isLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading events...</p>
                  </div>
                ) : rawEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No events found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {rawEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 text-sm">
                          <div className="w-24 text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </div>
                          <div className="w-12">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="w-32">
                            <Badge className={getEventTypeColor(event.type)}>
                              {event.type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="w-32 font-medium">
                            {event.data.modelName || 'N/A'}
                          </div>
                          <div className="w-20 text-right">
                            {event.data.tokens ? event.data.tokens.toLocaleString() : 'N/A'}
                          </div>
                          <div className="w-20 text-right">
                            {event.data.cost ? `$${event.data.cost.toFixed(4)}` : 'N/A'}
                          </div>
                        </div>
                        
                        {event.data.duration && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.data.duration}ms
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-sm text-muted-foreground">{user?.fullName || user?.firstName || 'Demo User'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress || 'demo@demo.dev'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>
                Customize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <p className="text-sm text-muted-foreground">Dark mode / Light mode settings</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Model</label>
                <p className="text-sm text-muted-foreground">Choose your preferred default model</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
