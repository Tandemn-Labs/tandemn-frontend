import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ModelBadge, PriceBadge, ContextBadge, PillStat } from '@/components/badge-components';
import { Model } from '@/mock/types';
import { formatLatency } from '@/lib/utils';

interface ModelCardProps {
  model: Model;
  view: 'list' | 'grid';
}

export function ModelCard({ model, view }: ModelCardProps) {
  if (view === 'grid') {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{model.name}</h3>
              <Link 
                href={`/models?vendor=${model.vendor}`}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {model.vendor}
              </Link>
            </div>
            <ModelBadge series={model.series} />
          </div>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {model.description}
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <ContextBadge tokens={model.context} />
              <span className="text-xs text-muted-foreground">
                {formatLatency(model.latencyMs)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <PriceBadge inputPrice={model.promptPrice} outputPrice={model.completionPrice} />
              <PillStat label="tokens/week" value={model.tokensPerWeek} />
            </div>

            <div className="flex flex-wrap gap-1">
              {model.modalities.map((modality) => (
                <span
                  key={modality}
                  className="inline-block px-2 py-1 text-xs bg-muted rounded"
                >
                  {modality}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-sm transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold">{model.name}</h3>
                <ModelBadge series={model.series} />
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Link 
                  href={`/models?vendor=${model.vendor}`}
                  className="hover:text-primary"
                >
                  {model.vendor}
                </Link>
                <span>•</span>
                <ContextBadge tokens={model.context} />
                <span>•</span>
                <PriceBadge inputPrice={model.promptPrice} outputPrice={model.completionPrice} />
              </div>
            </div>

            <div className="hidden md:block flex-1 max-w-md">
              <p className="text-sm text-muted-foreground line-clamp-1">
                {model.description}
              </p>
            </div>

            <div className="hidden lg:flex items-center space-x-4">
              <div className="text-xs text-muted-foreground">
                {formatLatency(model.latencyMs)}
              </div>
              <div className="flex space-x-1">
                {model.modalities.slice(0, 2).map((modality) => (
                  <span
                    key={modality}
                    className="inline-block px-2 py-1 text-xs bg-muted rounded"
                  >
                    {modality}
                  </span>
                ))}
                {model.modalities.length > 2 && (
                  <span className="inline-block px-2 py-1 text-xs bg-muted rounded">
                    +{model.modalities.length - 2}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <PillStat label="tokens/week" value={model.tokensPerWeek} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
