'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ModelFiltersProps {
  filters: {
    modalities: string[];
    series: string[];
    contextMin: number;
    contextMax: number;
    promptPriceMax: number;
  };
  onFiltersChange: (filters: any) => void;
  onClearFilters: () => void;
}

export function ModelFilters({ filters, onFiltersChange, onClearFilters }: ModelFiltersProps) {
  const modalityOptions = [
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    { value: 'file', label: 'File' },
    { value: 'audio', label: 'Audio' },
  ];

  const seriesOptions = [
    { value: 'GPT', label: 'GPT' },
    { value: 'Claude', label: 'Claude' },
    { value: 'Gemini', label: 'Gemini' },
    { value: 'Mistral', label: 'Mistral' },
    { value: 'Llama', label: 'Llama' },
    { value: 'Other', label: 'Other' },
  ];

  const handleModalityChange = (modality: string, checked: boolean) => {
    const newModalities = checked
      ? [...filters.modalities, modality]
      : filters.modalities.filter(m => m !== modality);
    
    onFiltersChange({ ...filters, modalities: newModalities });
  };

  const handleSeriesChange = (series: string, checked: boolean) => {
    const newSeries = checked
      ? [...filters.series, series]
      : filters.series.filter(s => s !== series);
    
    onFiltersChange({ ...filters, series: newSeries });
  };

  const handleContextChange = (values: number[]) => {
    onFiltersChange({
      ...filters,
      contextMin: values[0],
      contextMax: values[1],
    });
  };

  const handlePriceChange = (values: number[]) => {
    onFiltersChange({
      ...filters,
      promptPriceMax: values[0],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Input Modalities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Input Modalities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {modalityOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`modality-${option.value}`}
                checked={filters.modalities.includes(option.value)}
                onCheckedChange={(checked) =>
                  handleModalityChange(option.value, checked as boolean)
                }
              />
              <Label
                htmlFor={`modality-${option.value}`}
                className="text-sm font-normal"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Series */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Series</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {seriesOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`series-${option.value}`}
                checked={filters.series.includes(option.value)}
                onCheckedChange={(checked) =>
                  handleSeriesChange(option.value, checked as boolean)
                }
              />
              <Label
                htmlFor={`series-${option.value}`}
                className="text-sm font-normal"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Context Length */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Context Length</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Slider
              value={[filters.contextMin, filters.contextMax]}
              min={0}
              max={1000000}
              step={1000}
              onValueChange={handleContextChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{filters.contextMin.toLocaleString()}</span>
              <span>{filters.contextMax.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Max Prompt Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Slider
              value={[filters.promptPriceMax]}
              min={0}
              max={15}
              step={0.1}
              onValueChange={handlePriceChange}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Up to ${filters.promptPriceMax.toFixed(2)} per 1M tokens
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
