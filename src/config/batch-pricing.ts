/**
 * Batch Inference Pricing Configuration
 * 
 * Based on Together.ai's Batch API pricing with 25% discount applied
 * Source: https://www.together.ai/pricing (Batch API price column)
 */

export interface BatchPricing {
  inputPricePer1M: number;  // Price per 1M input tokens in USD
  outputPricePer1M: number; // Price per 1M output tokens in USD
  batchDiscount: number;    // Discount percentage (0-1)
}

// Together.ai Batch API base prices with 25% discount already applied
const BATCH_PRICING_MAP: Record<string, BatchPricing> = {
  // Llama 3.1 8B models - Together.ai Batch: $0.18, with 25% discount: $0.135
  'llama-3.1-8b': {
    inputPricePer1M: 0.135,
    outputPricePer1M: 0.135,
    batchDiscount: 0.25
  },
  'meta-llama/Llama-3.1-8B-Instruct': {
    inputPricePer1M: 0.135,
    outputPricePer1M: 0.135,
    batchDiscount: 0.25
  },
  'meta-llama/Meta-Llama-3.1-8B-Instruct': {
    inputPricePer1M: 0.135,
    outputPricePer1M: 0.135,
    batchDiscount: 0.25
  },
  
  // Llama 3.3 70B - Together.ai Batch: $0.88, with 25% discount: $0.66
  'llama-3.3-70b': {
    inputPricePer1M: 0.66,
    outputPricePer1M: 0.66,
    batchDiscount: 0.25
  },
  'casperhansen/llama-3.3-70b-instruct-awq': {
    inputPricePer1M: 0.66,
    outputPricePer1M: 0.66,
    batchDiscount: 0.25
  },
  'meta-llama/llama-3.3-70b-instruct': {
    inputPricePer1M: 0.66,
    outputPricePer1M: 0.66,
    batchDiscount: 0.25
  },
  
  // Llama 3.1 70B - Together.ai Batch: $0.88, with 25% discount: $0.66
  'llama-3.1-70b': {
    inputPricePer1M: 0.66,
    outputPricePer1M: 0.66,
    batchDiscount: 0.25
  },
  
  // Llama 3.1 405B - Together.ai Batch: $3.50, with 25% discount: $2.625
  'llama-3.1-405b': {
    inputPricePer1M: 2.625,
    outputPricePer1M: 2.625,
    batchDiscount: 0.25
  },
  
  // Qwen models - Qwen 2.5 72B: Together.ai Batch: $1.20, with 25% discount: $0.90
  'Qwen/Qwen3-32B-AWQ': {
    inputPricePer1M: 0.90,
    outputPricePer1M: 0.90,
    batchDiscount: 0.25
  },
  'qwen-2.5-72b': {
    inputPricePer1M: 0.90,
    outputPricePer1M: 0.90,
    batchDiscount: 0.25
  },
  
  // DeepSeek R1 Distilled models - DeepSeek R1 Distilled Llama 70B: $2.00, with 25% discount: $1.50
  'casperhansen/deepseek-r1-distill-llama-70b-awq': {
    inputPricePer1M: 1.50,
    outputPricePer1M: 1.50,
    batchDiscount: 0.25
  },
  'deepseek-r1-distill-llama-70b': {
    inputPricePer1M: 1.50,
    outputPricePer1M: 1.50,
    batchDiscount: 0.25
  },
  
  // Devstral/Mistral models - Using similar pricing to Llama 3.1 70B
  'btbtyler09/Devstral-Small-2507-AWQ': {
    inputPricePer1M: 0.66,
    outputPricePer1M: 0.66,
    batchDiscount: 0.25
  },
  'devstral-small-2507': {
    inputPricePer1M: 0.66,
    outputPricePer1M: 0.66,
    batchDiscount: 0.25
  },
};

// Default pricing for unknown models (use Llama 3.1 8B pricing as baseline)
const DEFAULT_BATCH_PRICING: BatchPricing = {
  inputPricePer1M: 0.135,
  outputPricePer1M: 0.135,
  batchDiscount: 0.25
};

/**
 * Get batch pricing for a specific model
 * @param modelId - The model ID
 * @returns Batch pricing configuration for the model
 */
export function getBatchPricing(modelId: string): BatchPricing {
  // Try exact match first
  let pricing = BATCH_PRICING_MAP[modelId];
  
  // Try case-insensitive match if exact match fails
  if (!pricing) {
    const normalizedId = modelId.toLowerCase();
    const entries = Object.entries(BATCH_PRICING_MAP);
    const match = entries.find(([key]) => key.toLowerCase() === normalizedId);
    pricing = match ? match[1] : DEFAULT_BATCH_PRICING;
  }
  
  // Return default pricing if no match found
  if (!pricing) {
    console.warn(`No batch pricing found for model: ${modelId}, using default pricing`);
    return DEFAULT_BATCH_PRICING;
  }
  
  return pricing;
}

/**
 * Calculate the cost for batch inference
 * @param modelId - The model ID
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Total cost in USD
 */
export function calculateBatchCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getBatchPricing(modelId);
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;
  const totalCost = inputCost + outputCost;
  
  // Return exact cost with full precision (no rounding)
  return totalCost;
}

/**
 * Estimate batch inference cost based on number of lines
 * @param modelId - The model ID
 * @param totalLines - Total number of lines to process
 * @param avgInputTokensPerLine - Average input tokens per line (default: 100)
 * @param avgOutputTokensPerLine - Average output tokens per line (default: 50)
 * @returns Estimated total cost in USD
 */
export function estimateBatchCost(
  modelId: string,
  totalLines: number,
  avgInputTokensPerLine: number = 100,
  avgOutputTokensPerLine: number = 50
): number {
  const estimatedInputTokens = totalLines * avgInputTokensPerLine;
  const estimatedOutputTokens = totalLines * avgOutputTokensPerLine;
  
  return calculateBatchCost(modelId, estimatedInputTokens, estimatedOutputTokens);
}

/**
 * Get all models with configured batch pricing
 * @returns Array of model IDs with batch pricing
 */
export function getAvailableBatchPricingModels(): string[] {
  return Object.keys(BATCH_PRICING_MAP);
}

