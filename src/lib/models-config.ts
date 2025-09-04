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

// Model configurations with real stats and OpenRouter mappings
export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'deepseek/deepseek-v3-0324-0',
    vendor: 'deepseek',
    series: 'DeepSeek',
    name: 'DeepSeek V3 0324',
    short: 'deepseek-v3-0324',
    context: 32768,
    promptPrice: 0.8,
    completionPrice: 1.6,
    tokensPerWeek: 15000000000,
    latencyMs: 1200,
    weeklyGrowthPct: 15.2,
    modalities: ['text'],
    description: 'Advanced language model with superior reasoning capabilities and code generation abilities.',
    badges: ['New', 'Popular'],
    openRouterModelId: 'deepseek/deepseek-chat-v3-0324',
  },
  {
    id: 'qwen/qwen3-coder-0',
    vendor: 'qwen',
    series: 'Qwen',
    name: 'Qwen3 Coder',
    short: 'qwen3-coder',
    context: 16384,
    promptPrice: 0.6,
    completionPrice: 1.2,
    tokensPerWeek: 8500000000,
    latencyMs: 800,
    weeklyGrowthPct: 8.7,
    modalities: ['text'],
    description: 'Specialized model for code generation, analysis, and software development tasks.',
    badges: ['Fast'],
    openRouterModelId: 'qwen/qwen3-coder',
  },
  {
    id: 'google/gemma-3-0',
    vendor: 'google',
    series: 'Gemini',
    name: 'Gemma 3',
    short: 'gemma-3',
    context: 8192,
    promptPrice: 0.5,
    completionPrice: 1.0,
    tokensPerWeek: 12000000000,
    latencyMs: 600,
    weeklyGrowthPct: 12.3,
    modalities: ['text'],
    description: 'Efficient language model with excellent balance of speed and quality.',
    badges: ['Fast'],
    openRouterModelId: 'google/gemma-3-27b-it',
  },
  {
    id: 'microsoft/phi-4-0',
    vendor: 'microsoft',
    series: 'Phi',
    name: 'Phi 4',
    short: 'phi-4',
    context: 4096,
    promptPrice: 0.4,
    completionPrice: 0.8,
    tokensPerWeek: 6500000000,
    latencyMs: 400,
    weeklyGrowthPct: 5.9,
    modalities: ['text'],
    description: 'Fast and reliable language model perfect for production applications.',
    badges: ['Fast'],
    openRouterModelId: 'microsoft/phi-4',
  },
  {
    id: 'meta/llama-3-3-70b-0',
    vendor: 'meta',
    series: 'Llama',
    name: 'Llama 3.3 70B',
    short: 'llama-3-3-70b',
    context: 65536,
    promptPrice: 0.7,
    completionPrice: 1.4,
    tokensPerWeek: 9500000000,
    latencyMs: 1500,
    weeklyGrowthPct: 18.1,
    modalities: ['text'],
    description: 'High-performance AI model optimized for complex tasks and creative applications.',
    badges: ['Popular'],
    openRouterModelId: 'meta-llama/llama-3.3-70b-instruct',
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
