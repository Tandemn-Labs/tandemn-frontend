import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModelBadge, DeltaPill, PillStat } from '@/components/badge-components';
import { Model } from '@/mock/types';
import { formatLatency } from '@/lib/utils';

interface FeaturedModelCardProps {
  model: Model;
}

export function FeaturedModelCard({ model }: FeaturedModelCardProps) {
  return (
    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg mb-1">{model.name}</h3>
            <p className="text-sm text-muted-foreground">{model.vendor}</p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <ModelBadge series={model.series} />
            {model.badges && model.badges.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {model.description}
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <PillStat 
              label="tokens/week" 
              value={model.tokensPerWeek} 
            />
            {model.weeklyGrowthPct && (
              <DeltaPill value={model.weeklyGrowthPct} />
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Latency:</span>
            <Badge variant="outline" className="text-xs">
              {formatLatency(model.latencyMs)}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Modalities:</span>
            <div className="flex space-x-1">
              {model.modalities.slice(0, 3).map((modality) => (
                <Badge key={modality} variant="outline" className="text-xs">
                  {modality}
                </Badge>
              ))}
              {model.modalities.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{model.modalities.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
