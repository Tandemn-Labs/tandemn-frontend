import { Model } from '@/mock/types';

// Centralized model configuration - single source of truth
export interface ModelConfig {
  id: string;
  vendor: string;
  series: string;
  name: string;
  short: string;
  context: number;
  promptPrice: number;
  completionPrice: number;
  tokensPerWeek: number;
  latencyMs: number;
  weeklyGrowthPct: number;
  modalities: ('text' | 'image' | 'file' | 'audio')[];
  description: string;
  badges?: string[];
  openRouterModelId: string; // Mapping to OpenRouter
}

// Tandem-only model configurations
export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'casperhansen/llama-3.3-70b-instruct-awq',
    vendor: 'tandem',
    series: 'Llama',
    name: 'Llama 3.3 70B Instruct (AWQ)',
    short: 'llama-3.3-70b-awq',
    context: 128000,
    promptPrice: 0.80,
    completionPrice: 0.80,
    tokensPerWeek: 20000000000,
    latencyMs: 800,
    weeklyGrowthPct: 25.5,
    modalities: ['text'],
    description: 'Meta\'s latest Llama model optimized for Tandem infrastructure with AWQ quantization.',
    badges: ['Tandem', 'Fast'],
    openRouterModelId: 'meta-llama/llama-3.3-70b-instruct',
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    vendor: 'tandem',
    series: 'Llama',
    name: 'Llama 3.1 70B Instruct',
    short: 'llama-3.1-70b',
    context: 131072,
    promptPrice: 0.88,
    completionPrice: 0.88,
    tokensPerWeek: 18000000000,
    latencyMs: 850,
    weeklyGrowthPct: 22.0,
    modalities: ['text'],
    description: 'High-performance language model with 70B parameters, excellent for complex reasoning tasks.',
    badges: ['Tandem', 'Reasoning'],
    openRouterModelId: 'meta-llama/llama-3.1-70b-instruct',
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    vendor: 'tandem',
    series: 'Llama',
    name: 'Llama 3.1 8B Instruct',
    short: 'llama-3.1-8b',
    context: 131072,
    promptPrice: 0.18,
    completionPrice: 0.18,
    tokensPerWeek: 25000000000,
    latencyMs: 200,
    weeklyGrowthPct: 30.0,
    modalities: ['text'],
    description: 'Efficient 8B parameter model, perfect for fast inference and cost-effective applications.',
    badges: ['Tandem', 'Fast', 'Efficient'],
    openRouterModelId: 'meta-llama/llama-3.1-8b-instruct',
  },
  {
    id: 'deepseek-ai/deepseek-coder-33b-instruct',
    vendor: 'tandem',
    series: 'DeepSeek',
    name: 'DeepSeek Coder 33B Instruct',
    short: 'deepseek-coder-33b',
    context: 16384,
    promptPrice: 0.55,
    completionPrice: 0.55,
    tokensPerWeek: 15000000000,
    latencyMs: 600,
    weeklyGrowthPct: 28.0,
    modalities: ['text'],
    description: 'Specialized coding model with 33B parameters, optimized for programming tasks and code generation.',
    badges: ['Tandem', 'Coding', 'Specialized'],
    openRouterModelId: 'deepseek-ai/deepseek-coder-33b-instruct',
  },
  {
    id: 'microsoft/wizardlm-2-8x22b',
    vendor: 'tandem',
    series: 'WizardLM',
    name: 'WizardLM-2 8x22B',
    short: 'wizardlm-2-8x22b',
    context: 65536,
    promptPrice: 1.20,
    completionPrice: 1.20,
    tokensPerWeek: 12000000000,
    latencyMs: 1000,
    weeklyGrowthPct: 18.0,
    modalities: ['text'],
    description: 'Mixture of experts model with exceptional reasoning capabilities and broad knowledge.',
    badges: ['Tandem', 'Expert', 'MoE'],
    openRouterModelId: 'microsoft/wizardlm-2-8x22b',
  },
];

// Convert ModelConfig to Model for compatibility
export function modelConfigToModel(config: ModelConfig): Model {
  return {
    id: config.id,
    vendor: config.vendor,
    series: config.series as any, // Type assertion for compatibility
    name: config.name,
    short: config.short,
    context: config.context,
    promptPrice: config.promptPrice,
    completionPrice: config.completionPrice,
    tokensPerWeek: config.tokensPerWeek,
    latencyMs: config.latencyMs,
    weeklyGrowthPct: config.weeklyGrowthPct,
    modalities: config.modalities,
    description: config.description,
    badges: config.badges,
  };
}

// Get all models
export function getAllModels(): Model[] {
  return MODEL_CONFIGS.map(modelConfigToModel).sort((a, b) => b.tokensPerWeek - a.tokensPerWeek);
}

// Get model by ID
export function getModelById(id: string): Model | undefined {
  const config = MODEL_CONFIGS.find(m => m.id === id);
  return config ? modelConfigToModel(config) : undefined;
}

// Get OpenRouter model ID mapping
export function getOpenRouterModelId(tandemnModelId: string): string {
  const config = MODEL_CONFIGS.find(m => m.id === tandemnModelId);
  if (config) {
    return config.openRouterModelId;
  }
  
  // Default fallback to Llama 3.3 70B
  return 'meta-llama/llama-3.3-70b-instruct';
}

// Get KPI stats from model data
export function getKPIStats() {
  const totalTokens = MODEL_CONFIGS.reduce((sum, model) => sum + model.tokensPerWeek, 0);
  const totalModels = MODEL_CONFIGS.length;
  const uniqueVendors = new Set(MODEL_CONFIGS.map(m => m.vendor)).size;
  
  return {
    monthlyTokens: `${(totalTokens * 4 / 1e12).toFixed(1)}T`, // Convert to monthly and format
    users: '1.2M', // This would come from real user data
    providers: uniqueVendors,
    models: totalModels,
  };
}

// Fetch real KPI stats from external APIs
export async function fetchRealKPIStats() {
  try {
    // Try to fetch from multiple sources
    const [openRouterStats, huggingFaceStats] = await Promise.allSettled([
      fetchOpenRouterStats(),
      fetchHuggingFaceStats(),
    ]);

    // Combine data from different sources
    const stats = {
      monthlyTokens: '0T',
      users: '0',
      providers: MODEL_CONFIGS.length,
      models: MODEL_CONFIGS.length,
    };

    // Use OpenRouter data if available
    if (openRouterStats.status === 'fulfilled') {
      stats.monthlyTokens = openRouterStats.value.monthlyTokens;
      stats.users = openRouterStats.value.users;
    }

    // Use Hugging Face data if available
    if (huggingFaceStats.status === 'fulfilled') {
      // Merge with existing stats
      Object.assign(stats, huggingFaceStats.value);
    }

    return stats;
  } catch (error) {
    console.error('Failed to fetch real KPI stats:', error);
    // Fallback to local data
    return getKPIStats();
  }
}

// Fetch stats from OpenRouter API
async function fetchOpenRouterStats() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Calculate stats from OpenRouter model data
    const totalRequests = data.data?.reduce((sum: number, model: any) => 
      sum + (model.top_provider?.requests_per_day || 0), 0) || 0;
    
    // Estimate monthly tokens (rough calculation)
    const avgTokensPerRequest = 1000; // Conservative estimate
    const monthlyTokens = totalRequests * 30 * avgTokensPerRequest;
    
    return {
      monthlyTokens: `${(monthlyTokens / 1e12).toFixed(1)}T`,
      users: `${(totalRequests / 1000).toFixed(1)}K`, // Rough estimate
    };
  } catch (error) {
    console.error('OpenRouter stats fetch failed:', error);
    throw error;
  }
}

// Fetch stats from Hugging Face API
async function fetchHuggingFaceStats() {
  try {
    // Get stats for our specific models
    const modelStats = await Promise.allSettled(
      MODEL_CONFIGS.map(async (model) => {
        const response = await fetch(`https://huggingface.co/api/models/${model.id}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        return {
          downloads: data.downloads || 0,
          likes: data.likes || 0,
        };
      })
    );

    // Aggregate stats
    const totalDownloads = modelStats
      .filter((result): result is PromiseFulfilledResult<{ downloads: number; likes: number } | null> => 
        result.status === 'fulfilled' && result.value !== null)
      .reduce((sum, result) => sum + (result.value?.downloads || 0), 0);

    const totalLikes = modelStats
      .filter((result): result is PromiseFulfilledResult<{ downloads: number; likes: number } | null> => 
        result.status === 'fulfilled' && result.value !== null)
      .reduce((sum, result) => sum + (result.value?.likes || 0), 0);

    return {
      totalDownloads,
      totalLikes,
      // Estimate users based on downloads
      users: `${(totalDownloads / 1000).toFixed(1)}K`,
    };
  } catch (error) {
    console.error('Hugging Face stats fetch failed:', error);
    throw error;
  }
}

// Get featured models (top 3 by popularity)
export function getFeaturedModels(): Model[] {
  return getAllModels().slice(0, 3);
}
