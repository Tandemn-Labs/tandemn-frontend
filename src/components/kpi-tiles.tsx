import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Zap, Building2, Bot } from 'lucide-react';
import { KPIStats } from '@/mock/types';

interface KPITilesProps {
  stats: KPIStats;
}

export function KPITiles({ stats }: KPITilesProps) {
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
  );
}
