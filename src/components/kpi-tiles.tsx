'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Zap, Building2, Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KPIStats } from '@/mock/types';

interface KPITilesProps {
  stats: KPIStats;
  enableRealTime?: boolean;
  className?: string;
}

export function KPITiles({ stats: initialStats, enableRealTime = false, className = '' }: KPITilesProps) {
  const [stats, setStats] = useState<KPIStats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRealTimeStats = async () => {
    if (!enableRealTime) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/kpi-stats?real=true');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch real-time stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enableRealTime) {
      fetchRealTimeStats();
    }
  }, [enableRealTime]);

  const tiles = [
    {
      title: 'Monthly Tokens',
      value: stats.monthlyTokens,
      icon: Zap,
      description: 'Processed this month',
    },
    {
      title: 'Global Users',
      value: stats.users,
      icon: Users,
      description: 'Active developers',
    },
    {
      title: 'Active Providers',
      value: stats.providers.toString(),
      icon: Building2,
      description: 'AI model providers',
    },
    {
      title: 'Models',
      value: stats.models.toString(),
      icon: Bot,
      description: 'Available models',
    },
  ];

  return (
    <div className={className}>
      {enableRealTime && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Real-time Statistics</h3>
          <div className="flex items-center space-x-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRealTimeStats}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {tile.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {tile.value}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tile.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
