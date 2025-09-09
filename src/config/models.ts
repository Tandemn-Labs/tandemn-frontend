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

// Tandem-deployed models only
export const TANDEMN_MODELS: TandemnModel[] = [
  {
    id: "casperhansen/llama-3.3-70b-instruct-awq",
    name: "Llama 3.3 70B Instruct (AWQ)",
    provider: "Tandem",
    description: "Meta's latest Llama model optimized for Tandem infrastructure with advanced quantization",
    context_length: 128000,
    input_price_per_1m: 0.80,   // $0.80 per 1M input tokens
    output_price_per_1m: 0.80,  // $0.80 per 1M output tokens
    capabilities: ["text", "reasoning", "coding", "fast-inference"],
    max_tokens: 4096,
    is_available: true  // Model available through fallback system
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B Instruct",
    provider: "Tandem",
    description: "High-performance language model with 70B parameters, excellent for complex reasoning tasks",
    context_length: 131072,
    input_price_per_1m: 0.88,
    output_price_per_1m: 0.88,
    capabilities: ["text", "reasoning", "coding", "analysis"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B Instruct",
    provider: "Tandem",
    description: "Efficient 8B parameter model, perfect for fast inference and cost-effective applications",
    context_length: 131072,
    input_price_per_1m: 0.18,
    output_price_per_1m: 0.18,
    capabilities: ["text", "reasoning", "coding", "fast-inference"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "deepseek-ai/deepseek-coder-33b-instruct",
    name: "DeepSeek Coder 33B Instruct",
    provider: "Tandem",
    description: "Specialized coding model with 33B parameters, optimized for programming tasks and code generation",
    context_length: 16384,
    input_price_per_1m: 0.55,
    output_price_per_1m: 0.55,
    capabilities: ["coding", "debugging", "code-review", "programming"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "microsoft/wizardlm-2-8x22b",
    name: "WizardLM-2 8x22B",
    provider: "Tandem",
    description: "Mixture of experts model with exceptional reasoning capabilities and broad knowledge",
    context_length: 65536,
    input_price_per_1m: 1.20,
    output_price_per_1m: 1.20,
    capabilities: ["text", "reasoning", "analysis", "expert-knowledge"],
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