import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelBadge, DeltaPill } from '@/components/badge-components';
import { formatTokens, formatLatency } from '@/lib/utils';
import { RankingModel } from '@/mock/types';

async function getRankings() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  try {
    const response = await fetch(`${baseUrl}/api/rankings`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export default async function RankingsPage() {
  const rankings: RankingModel[] = await getRankings();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Model Rankings</h1>
        <p className="text-muted-foreground">
          Top performing models ranked by weekly token usage and performance metrics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 100 Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">#</th>
                  <th className="text-left py-3 px-4 font-medium">Model</th>
                  <th className="text-left py-3 px-4 font-medium">Vendor</th>
                  <th className="text-left py-3 px-4 font-medium">Tokens/Week</th>
                  <th className="text-left py-3 px-4 font-medium">Latency</th>
                  <th className="text-left py-3 px-4 font-medium">Growth</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((model, index) => (
                  <tr key={model.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{model.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {model.vendor}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-mono">
                        {formatTokens(model.tokensPerWeek)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-mono">
                        {formatLatency(model.latencyMs)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {model.weeklyGrowthPct !== undefined ? (
                        <DeltaPill value={model.weeklyGrowthPct} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
