'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Grid, List, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelFilters } from '@/components/model-filters';
import { ModelCard } from '@/components/model-card';
import { useUIStore } from '@/store/ui';
import { Model, ModelsResponse } from '@/mock/types';

export default function ModelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { modelsView, setModelsView } = useUIStore();
  
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'popularity');
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  const [filters, setFilters] = useState({
    modalities: [] as string[],
    series: [] as string[],
    contextMin: 0,
    contextMax: 1000000,
    promptPriceMax: 15,
  });

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set('q', searchQuery);
    if (sortBy !== 'popularity') params.set('sort', sortBy);
    if (filters.modalities.length > 0) {
      filters.modalities.forEach(m => params.append('modalities', m));
    }
    if (filters.series.length > 0) {
      filters.series.forEach(s => params.append('series', s));
    }
    if (filters.contextMin > 0) params.set('contextMin', filters.contextMin.toString());
    if (filters.contextMax < 1000000) params.set('contextMax', filters.contextMax.toString());
    if (filters.promptPriceMax < 15) params.set('promptPriceMax', filters.promptPriceMax.toString());
    if (page > 1) params.set('page', page.toString());
    
    return params;
  }, [searchQuery, sortBy, filters, page]);

  // Fetch models
  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/models?${queryParams.toString()}`);
        const data: ModelsResponse = await response.json();
        
        setModels(data.items);
        setTotal(data.total);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [queryParams]);

  // Update URL when filters change
  useEffect(() => {
    const newUrl = `/models${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [queryParams, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      modalities: [],
      series: [],
      contextMin: 0,
      contextMax: 1000000,
      promptPriceMax: 15,
    });
    setPage(1);
  };

  const hasActiveFilters = 
    filters.modalities.length > 0 ||
    filters.series.length > 0 ||
    filters.contextMin > 0 ||
    filters.contextMax < 1000000 ||
    filters.promptPriceMax < 15;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className={`lg:w-80 ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <ModelFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Models</h1>
              <p className="text-muted-foreground">
                {loading ? 'Loading...' : `${total.toLocaleString()} models available`}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 h-2 w-2 bg-primary rounded-full" />
              )}
            </Button>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </form>
            
            <div className="flex items-center space-x-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="latency">Latency</SelectItem>
                  <SelectItem value="priceLow">Price: Low to High</SelectItem>
                  <SelectItem value="priceHigh">Price: High to Low</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center border rounded-md">
                <Button
                  variant={modelsView === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setModelsView('list')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={modelsView === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setModelsView('grid')}
                  className="rounded-l-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Models List/Grid */}
          <div className={
            modelsView === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
              : 'space-y-4'
          }>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted rounded-lg h-32" />
                </div>
              ))
            ) : models.length > 0 ? (
              models.map((model) => (
                <ModelCard key={model.id} model={model} view={modelsView} />
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No models found matching your criteria.</p>
                <Button variant="outline" onClick={handleClearFilters} className="mt-4">
                  Clear Filters
                </Button>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && models.length > 0 && total > models.length && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={loading}
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
