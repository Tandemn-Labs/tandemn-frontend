import { Model, KPIStats } from './types';

// Deterministic seeded data for consistent results
const vendors = ['openai', 'anthropic', 'google', 'mistral', 'meta', 'perplexity', 'cohere', 'groq'];
const seriesMap: Record<string, Model['series']> = {
  'openai': 'GPT',
  'anthropic': 'Claude',
  'google': 'Gemini',
  'mistral': 'Mistral',
  'meta': 'Llama',
  'perplexity': 'Other',
  'cohere': 'Other',
  'groq': 'Other',
};

const modalityOptions: Model['modalities'][number][] = ['text', 'image', 'file', 'audio'];

// Generate deterministic random values
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomChoice<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seededRandom(seed) * arr.length)];
}

function randomInt(min: number, max: number, seed: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, seed: number): number {
  return seededRandom(seed) * (max - min) + min;
}

// Generate model names based on vendor and series
function generateModelName(vendor: string, index: number): string {
  const baseNames: Record<string, string[]> = {
    'openai': ['GPT-4o', 'GPT-4', 'GPT-3.5-turbo', 'GPT-4-vision', 'GPT-4-32k'],
    'anthropic': ['Claude-3.5-Sonnet', 'Claude-3-Opus', 'Claude-3-Haiku', 'Claude-2.1', 'Claude-Instant'],
    'google': ['Gemini-2.0-Pro', 'Gemini-1.5-Pro', 'Gemini-1.0-Ultra', 'PaLM-2', 'Bard'],
    'mistral': ['Mistral-Large', 'Mistral-Medium', 'Mistral-Small', 'Mixtral-8x7B', 'Mistral-7B'],
    'meta': ['Llama-3.1-405B', 'Llama-3.1-70B', 'Llama-3.1-8B', 'Llama-2-70B', 'Code-Llama'],
    'perplexity': ['Perplexity-7B', 'Perplexity-70B', 'PPLX-Online', 'PPLX-Chat'],
    'cohere': ['Command-R+', 'Command-R', 'Command', 'Command-Light'],
    'groq': ['Llama-3-Groq', 'Mixtral-Groq', 'Gemma-Groq'],
  };
  
  const names = baseNames[vendor] || ['Model-A', 'Model-B', 'Model-C'];
  return names[index % names.length] || `${vendor}-${index}`;
}

export function generateModels(count: number = 500): Model[] {
  const models: Model[] = [];
  
  for (let i = 0; i < count; i++) {
    const vendor = randomChoice(vendors, i * 7);
    const series = seriesMap[vendor] || 'Other';
    const name = generateModelName(vendor, i);
    const short = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Generate modalities
    const numModalities = randomInt(1, 3, i * 11);
    const modalities: Model['modalities'] = ['text']; // Always include text
    for (let j = 1; j < numModalities; j++) {
      const modality = randomChoice(modalityOptions.slice(1), i * 13 + j);
      if (!modalities.includes(modality)) {
        modalities.push(modality);
      }
    }
    
    // Generate realistic pricing and context
    const contextOptions = [4096, 8192, 16384, 32768, 65536, 131072, 200000, 1000000];
    const context = randomChoice(contextOptions, i * 17);
    
    // Token-based pricing: Higher rates for testing
    // Base rates: $1000/1M input tokens, $2000/1M output tokens  
    // This means ~10 input tokens = $1, ~5 output tokens = $1
    // Different models have different multipliers
    const pricingTiers = {
      'openai': { inputMultiplier: 1.5, outputMultiplier: 1.5 },   // Premium pricing
      'anthropic': { inputMultiplier: 1.2, outputMultiplier: 1.2 }, // High-end
      'google': { inputMultiplier: 0.8, outputMultiplier: 0.8 },    // Competitive
      'mistral': { inputMultiplier: 0.6, outputMultiplier: 0.6 },   // Mid-range
      'meta': { inputMultiplier: 0.4, outputMultiplier: 0.4 },      // Open source, lower cost
      'perplexity': { inputMultiplier: 0.7, outputMultiplier: 0.7 }, // Specialty
      'cohere': { inputMultiplier: 0.9, outputMultiplier: 0.9 },    // Business focused
      'groq': { inputMultiplier: 0.3, outputMultiplier: 0.3 },      // Fast, low cost
    };
    
    const baseTier = pricingTiers[vendor as keyof typeof pricingTiers] || { inputMultiplier: 1.0, outputMultiplier: 1.0 };
    
    // Add some model-specific variation (±30%)
    const modelVariation = randomFloat(0.7, 1.3, i * 19);
    
    // Base: $1000/1M input tokens, $2000/1M output tokens (100x higher for testing)
    const promptPrice = Math.round((1000.0 * baseTier.inputMultiplier * modelVariation) * 100) / 100;
    const completionPrice = Math.round((2000.0 * baseTier.outputMultiplier * modelVariation) * 100) / 100;
    
    const tokensPerWeek = randomInt(1000000, 500000000000, i * 29);
    const latencyMs = randomInt(200, 8000, i * 31);
    
    const weeklyGrowthPct = seededRandom(i * 37) > 0.7 ? randomFloat(-50, 100, i * 41) : undefined;
    
    // Generate badges occasionally
    const badges: string[] = [];
    if (seededRandom(i * 43) > 0.8) badges.push('New');
    if (seededRandom(i * 47) > 0.9) badges.push('Popular');
    if (seededRandom(i * 53) > 0.85) badges.push('Fast');
    
    const descriptions = [
      'Advanced language model with superior reasoning capabilities and multimodal understanding.',
      'High-performance AI model optimized for complex tasks and creative applications.',
      'Efficient language model with excellent balance of speed and quality.',
      'Specialized model for code generation, analysis, and software development tasks.',
      'Cutting-edge AI with enhanced safety features and improved factual accuracy.',
      'Versatile model supporting multiple languages and diverse use cases.',
      'Premium AI assistant with advanced reasoning and problem-solving abilities.',
      'Fast and reliable language model perfect for production applications.',
    ];
    
    const model: Model = {
      id: `${vendor}/${short}-${i}`, // Add index to ensure uniqueness
      vendor,
      series,
      name,
      short,
      context,
      promptPrice: Number(promptPrice.toFixed(2)),
      completionPrice: Number(completionPrice.toFixed(2)),
      tokensPerWeek,
      latencyMs,
      weeklyGrowthPct: weeklyGrowthPct ? Number(weeklyGrowthPct.toFixed(1)) : undefined,
      modalities,
      description: randomChoice(descriptions, i * 59),
      badges: badges.length > 0 ? badges : undefined,
    };
    
    models.push(model);
  }
  
  return models.sort((a, b) => b.tokensPerWeek - a.tokensPerWeek);
}

export function getFeaturedModels(models: Model[]): Model[] {
  // Return top 3 most popular models as featured
  return models.slice(0, 3);
}

export function getKPIStats(): KPIStats {
  return {
    monthlyTokens: '2.1T',
    users: '1.2M',
    providers: 8,
    models: 500,
  };
}
