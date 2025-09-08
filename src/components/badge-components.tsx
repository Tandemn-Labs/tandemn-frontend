import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatTokens, formatPrice, formatLatency, formatContext } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PriceBadgeProps {
  price?: number;
  inputPrice?: number;
  outputPrice?: number;
  label?: string;
  className?: string;
}

export function PriceBadge({ price, inputPrice, outputPrice, label = 'from', className }: PriceBadgeProps) {
  if (inputPrice !== undefined && outputPrice !== undefined) {
    return (
      <div className={cn('flex space-x-1', className)}>
        <Badge variant="secondary" className="text-xs">
          In: {formatPrice(inputPrice)}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Out: {formatPrice(outputPrice)}
        </Badge>
      </div>
    );
  }
  
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {label} {formatPrice(price || 0)}
    </Badge>
  );
}

interface ContextBadgeProps {
  tokens: number;
  className?: string;
}

export function ContextBadge({ tokens, className }: ContextBadgeProps) {
  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      {formatContext(tokens)} context
    </Badge>
  );
}

interface DeltaPillProps {
  value: number;
  className?: string;
}

export function DeltaPill({ value, className }: DeltaPillProps) {
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <div
      className={cn(
        'inline-flex items-center space-x-1 rounded-full px-2 py-1 text-xs font-medium',
        isPositive
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
}

interface PillStatProps {
  label: string;
  value: string | number;
  className?: string;
}

export function PillStat({ label, value, className }: PillStatProps) {
  return (
    <div className={cn('inline-flex items-center space-x-2', className)}>
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Badge variant="outline" className="text-xs">
        {typeof value === 'number' ? formatTokens(value) : value}
      </Badge>
    </div>
  );
}

interface ModelBadgeProps {
  series: string;
  className?: string;
}

export function ModelBadge({ series, className }: ModelBadgeProps) {
  const colorMap: Record<string, string> = {
    GPT: 'bg-blue-50 text-blue-700 border-blue-200',
    Claude: 'bg-purple-50 text-purple-700 border-purple-200',
    Gemini: 'bg-orange-50 text-orange-700 border-orange-200',
    Mistral: 'bg-pink-50 text-pink-700 border-pink-200',
    Llama: 'bg-green-50 text-green-700 border-green-200',
    Other: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs border',
        colorMap[series] || colorMap.Other,
        className
      )}
    >
      {series}
    </Badge>
  );
}
