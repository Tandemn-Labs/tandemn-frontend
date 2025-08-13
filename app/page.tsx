import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeaturedModelCard } from '@/components/featured-model-card';
import { KPITiles } from '@/components/kpi-tiles';

async function getFeaturedData() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  try {
    const response = await fetch(`${baseUrl}/api/featured`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  } catch {
    // Fallback mock data
    return {
      featured: [],
      kpis: {
        monthlyTokens: '2.1T',
        users: '1.2M',
        providers: 8,
        models: 500,
      },
    };
  }
}

export default async function HomePage() {
  const { featured, kpis } = await getFeaturedData();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            The unified interface for LLMs
          </h1>
        </div>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Access the world's best AI models through a single API. 
          Compare performance, pricing, and capabilities across providers.
        </p>
        
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <form 
            action="/chat" 
            method="GET"
            className="flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <Input
                name="q"
                placeholder="Start a message..."
                className="h-12 text-base pr-12"
              />
              <Button 
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-10 w-10"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
          <p className="text-sm text-muted-foreground mt-2">
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs">/</kbd> to focus search
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Featured Models */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Featured Models</h2>
            <Button variant="outline" asChild>
              <Link href="/models">View All</Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featured.slice(0, 4).map((model: any) => (
              <FeaturedModelCard key={model.id} model={model} />
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/models">Browse Models</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/chat">Start Chatting</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/rankings">View Rankings</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/docs">Read Docs</Link>
            </Button>
          </div>
          
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Why Choose Us?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Single API for all models</li>
              <li>• Real-time performance metrics</li>
              <li>• Transparent pricing</li>
              <li>• Production-ready infrastructure</li>
            </ul>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="mb-8">
        <KPITiles stats={kpis} />
      </div>

      {/* CTA Section */}
      <div className="text-center">
        <div className="bg-muted/50 rounded-lg p-8">
          <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
          <p className="text-muted-foreground mb-6">
            Join thousands of developers building the next generation of AI applications.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Button size="lg" asChild>
              <Link href="/signin">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/models">Explore Models</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
