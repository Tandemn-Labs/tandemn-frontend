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
    <div className="min-h-screen relative">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 dot-pattern opacity-50"></div>
      
      <div className="container mx-auto px-4 py-6 md:py-12 max-w-7xl relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-20">
          {/* Logo and Title */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 md:mb-8">
            <img src="/tandemn-logo-circle.svg" alt="Tandemn" className="h-16 w-16 md:h-20 md:w-20 gentle-float" />
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold gradient-text mb-2">
                Tandemn
              </h1>
              <div className="text-sm md:text-base text-muted-foreground">
                AI Infrastructure Layer
              </div>
            </div>
          </div>
          
          {/* Subtitle */}
          <div className="mb-8 md:mb-12 max-w-4xl mx-auto">
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 md:mb-6 font-light">
              The missing layer between <span className="gradient-text font-semibold">underutilized accelerators</span> 
              and massive models
            </p>
            <div className="text-sm md:text-base text-accent/70">
              Zero-friction scheduling • KV-block teleportation • Ultra-light messaging
            </div>
          </div>
          
          {/* Modern Search Interface */}
          <div className="max-w-2xl mx-auto mb-8 md:mb-12">
            <div className="glass-card p-4 md:p-6 subtle-glow">
              <form 
                action="/chat" 
                method="GET"
                className="space-y-4"
              >
                <div className="relative">
                  <Input
                    name="q"
                    placeholder="Start your AI conversation..."
                    className="h-14 text-base border-accent/20 bg-background/50 pl-4 pr-14"
                  />
                  <Button 
                    type="submit"
                    className="absolute right-2 top-2 h-10 w-10 modern-button"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <div className="status-dot bg-green-400"></div>
                    <span>NVIDIA • AMD • Intel</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="status-dot bg-accent"></div>
                    <span>Open Source</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="status-dot bg-primary"></div>
                    <span>Real-time Cooperation</span>
                  </div>
                </div>
              </form>
            </div>
          </div>
          
          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button className="modern-button text-base px-8 py-3" asChild>
              <Link href="/chat">
                Get Started
              </Link>
            </Button>
            <Button variant="outline" className="text-base px-8 py-3 border-accent/30 hover:bg-accent/5" asChild>
              <Link href="/credits">
                View Pricing
              </Link>
            </Button>
          </div>
        </div>

        {/* Infrastructure Features Section */}
        <div className="mb-12 md:mb-20">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-4">Distributed AI Infrastructure</h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Making top-tier AI effortless across NVIDIA, AMD, Intel, and custom silicon
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-card p-4 md:p-6 hover:subtle-glow transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                    Zero-Friction Scheduling
                  </h3>
                  <div className="text-accent text-sm">
                    Smart Resource Allocation
                  </div>
                </div>
                <div className="status-dot bg-green-400"></div>
              </div>
              
              <p className="text-muted-foreground mb-4 text-sm">
                Intelligent workload distribution across heterogeneous accelerators with minimal overhead
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="text-accent">Sub-millisecond</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Efficiency:</span>
                  <span className="text-green-400">99.9%</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 md:p-6 hover:subtle-glow transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                    KV-Block Teleportation
                  </h3>
                  <div className="text-accent text-sm">
                    Memory Optimization
                  </div>
                </div>
                <div className="status-dot bg-green-400"></div>
              </div>
              
              <p className="text-muted-foreground mb-4 text-sm">
                Seamless memory block transfer across different hardware architectures
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer:</span>
                  <span className="text-accent">Real-time</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overhead:</span>
                  <span className="text-green-400">Near-zero</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 md:p-6 hover:subtle-glow transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                    Ultra-Light Messaging
                  </h3>
                  <div className="text-accent text-sm">
                    Hardware Communication
                  </div>
                </div>
                <div className="status-dot bg-green-400"></div>
              </div>
              
              <p className="text-muted-foreground mb-4 text-sm">
                High-performance inter-accelerator communication with minimal resource usage
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bandwidth:</span>
                  <span className="text-accent">100+ Gbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocol:</span>
                  <span className="text-green-400">Custom</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <div className="glass-card p-6 max-w-2xl mx-auto">
              <p className="text-muted-foreground mb-4">
                <strong className="gradient-text">Coming Soon:</strong> Code, benchmarks, and integrations are on the way
              </p>
              <p className="text-sm text-accent/70">
                Eradicating under-utilization • Making top-tier AI effortless • Open source community
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-12 md:mb-20">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-4">Platform Features</h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Everything you need to build, deploy, and scale AI applications
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="glass-card p-4 md:p-6 text-center group hover:subtle-glow transition-all duration-300">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/30 transition-colors">
                <div className="w-6 h-6 border-2 border-accent rounded"></div>
              </div>
              <h3 className="font-semibold text-lg mb-2">Unified API</h3>
              <p className="text-muted-foreground text-sm">
                Single interface for all AI models and providers
              </p>
            </div>
            
            <div className="glass-card p-6 text-center group hover:subtle-glow transition-all duration-300">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/30 transition-colors">
                <div className="w-6 h-6 bg-primary rounded-full"></div>
              </div>
              <h3 className="font-semibold text-lg mb-2">Real-time Analytics</h3>
              <p className="text-muted-foreground text-sm">
                Live performance monitoring and detailed insights
              </p>
            </div>
            
            <div className="glass-card p-6 text-center group hover:subtle-glow transition-all duration-300">
              <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-green-400/30 transition-colors">
                <div className="w-6 h-6 border-2 border-green-400 rounded-full"></div>
              </div>
              <h3 className="font-semibold text-lg mb-2">Enterprise Scale</h3>
              <p className="text-muted-foreground text-sm">
                Production-ready infrastructure that scales with you
              </p>
            </div>
            
            <div className="glass-card p-6 text-center group hover:subtle-glow transition-all duration-300">
              <div className="w-12 h-12 bg-purple-400/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-400/30 transition-colors">
                <div className="w-6 h-6 bg-purple-400 rounded"></div>
              </div>
              <h3 className="font-semibold text-lg mb-2">Transparent Pricing</h3>
              <p className="text-muted-foreground text-sm">
                Clear, usage-based pricing with no hidden fees
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="mb-12 md:mb-20">
          <div className="glass-card p-4 md:p-8">
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold gradient-text mb-2">Platform Statistics</h2>
              <p className="text-sm md:text-base text-muted-foreground">Real-time metrics from our global network</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold gradient-text mb-2">{kpis.monthlyTokens}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Tokens Processed</div>
                <div className="w-full h-1 bg-accent/20 rounded-full mt-2">
                  <div className="w-4/5 h-1 bg-accent rounded-full"></div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary mb-2">{kpis.users}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Active Users</div>
                <div className="w-full h-1 bg-primary/20 rounded-full mt-2">
                  <div className="w-3/5 h-1 bg-primary rounded-full"></div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-green-400 mb-2">{kpis.providers}</div>
                <div className="text-xs md:text-sm text-muted-foreground">AI Providers</div>
                <div className="w-full h-1 bg-green-400/20 rounded-full mt-2">
                  <div className="w-full h-1 bg-green-400 rounded-full"></div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-purple-400 mb-2">{kpis.models}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Models Available</div>
                <div className="w-full h-1 bg-purple-400/20 rounded-full mt-2">
                  <div className="w-5/6 h-1 bg-purple-400 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Statistics */}
        <div className="mb-12 md:mb-20">
          <KPITiles stats={kpis} enableRealTime={true} />
        </div>

        {/* Featured Models */}
        {featured && featured.length > 0 && (
          <div className="mb-12 md:mb-20">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-4">Featured Models</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                Top performing models based on usage and community feedback
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((model: any) => (
                <FeaturedModelCard key={model.id} model={model} />
              ))}
            </div>
          </div>
        )}

        {/* Final CTA Section */}
        <div className="text-center mb-12 md:mb-20">
          <div className="glass-card p-6 md:p-12 subtle-glow max-w-4xl mx-auto">
            <div className="mb-6 md:mb-8">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-4">
                Ready to get started?
              </h3>
              <p className="text-lg md:text-xl text-muted-foreground font-light mb-2">
                Join the open-source community building distributed AI infrastructure
              </p>
              <div className="text-accent/80 text-sm md:text-base">
                Help us eradicate under-utilization across all hardware
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Button className="modern-button text-lg px-10 py-4" asChild>
                <Link href="/sign-up">
                  Get Started Free
                </Link>
              </Button>
              <Button variant="outline" className="text-lg px-10 py-4 border-accent/30 hover:bg-accent/5" asChild>
                <Link href="/chat">
                  Explore Platform
                </Link>
              </Button>
            </div>
            
            <div className="mt-8 pt-8 border-t border-border">
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="status-dot bg-green-400"></div>
                  <span>No commitment required</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="status-dot bg-accent"></div>
                  <span>Instant access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="status-dot bg-primary"></div>
                  <span>Enterprise ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
