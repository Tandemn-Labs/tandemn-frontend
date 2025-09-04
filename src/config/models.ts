// Core 5 Models Configuration for Tandemn
export interface TandemnModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  context_length: number;
  input_price_per_1m: number;  // Price per 1M input tokens in USD
  output_price_per_1m: number; // Price per 1M output tokens in USD
  capabilities: string[];
  max_tokens: number;
  is_available: boolean;
}

// The 5 core models we support
export const TANDEMN_MODELS: TandemnModel[] = [
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Most intelligent model with excellent reasoning, writing, and analysis capabilities",
    context_length: 200000,
    input_price_per_1m: 3.00,   // $3 per 1M input tokens
    output_price_per_1m: 15.00, // $15 per 1M output tokens
    capabilities: ["text", "reasoning", "analysis", "coding"],
    max_tokens: 8192,
    is_available: true
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "OpenAI's flagship model with multimodal capabilities and high intelligence",
    context_length: 128000,
    input_price_per_1m: 2.50,   // $2.50 per 1M input tokens  
    output_price_per_1m: 10.00, // $10 per 1M output tokens
    capabilities: ["text", "vision", "reasoning", "coding"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro", 
    provider: "Google",
    description: "Google's advanced model with 2M token context and multimodal reasoning",
    context_length: 2097152,
    input_price_per_1m: 1.25,   // $1.25 per 1M input tokens
    output_price_per_1m: 5.00,  // $5 per 1M output tokens
    capabilities: ["text", "vision", "reasoning", "long-context"],
    max_tokens: 8192,
    is_available: true
  },
  {
    id: "llama-3.1-405b",
    name: "Llama 3.1 405B",
    provider: "Meta",
    description: "Meta's largest open-source model with exceptional performance across all tasks",
    context_length: 32768,
    input_price_per_1m: 2.70,   // $2.70 per 1M input tokens
    output_price_per_1m: 2.70,  // $2.70 per 1M output tokens
    capabilities: ["text", "reasoning", "coding", "open-source"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "mixtral-8x22b",
    name: "Mixtral 8x22B",
    provider: "Mistral AI",
    description: "High-performance mixture-of-experts model optimized for efficiency and speed",
    context_length: 65536,
    input_price_per_1m: 0.90,   // $0.90 per 1M input tokens
    output_price_per_1m: 0.90,  // $0.90 per 1M output tokens
    capabilities: ["text", "fast-inference", "efficiency", "multilingual"],
    max_tokens: 4096,
    is_available: true
  }
];

// Helper functions
export function getModelById(modelId: string): TandemnModel | undefined {
  return TANDEMN_MODELS.find(model => model.id === modelId);
}

export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  
  const inputCost = (inputTokens / 1000000) * model.input_price_per_1m;
  const outputCost = (outputTokens / 1000000) * model.output_price_per_1m;
  const totalCost = inputCost + outputCost;
  
  // Round to 4 decimal places for precision, minimum $0.0001
  return Math.max(Math.round(totalCost * 10000) / 10000, 0.0001);
}

export function getAllModels(): TandemnModel[] {
  return TANDEMN_MODELS.filter(model => model.is_available);
}

export function getModelPricing() {
  return TANDEMN_MODELS.map(model => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    input_price_per_1m: model.input_price_per_1m,
    output_price_per_1m: model.output_price_per_1m,
    context_length: model.context_length
  }));
}