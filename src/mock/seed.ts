import { Model, KPIStats } from './types';
import { getAllModels, getKPIStats as getKPIStatsFromConfig, getFeaturedModels as getFeaturedModelsFromConfig } from '@/lib/models-config';

// This file now uses centralized configuration from @/lib/models-config

export function generateModels(count: number = 5): Model[] {
  // Use centralized model configuration
  return getAllModels();
}

export function getFeaturedModels(models: Model[]): Model[] {
  // Use centralized configuration
  return getFeaturedModelsFromConfig();
}

export function getKPIStats(): KPIStats {
  // Use centralized configuration that calculates from actual model data
  return getKPIStatsFromConfig();
}
