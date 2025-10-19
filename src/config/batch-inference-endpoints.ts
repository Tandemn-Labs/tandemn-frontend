/**
 * Batch Inference Endpoint Configuration
 * 
 * Maps model names to their respective batch inference server URLs.
 * This allows for easy management of multiple batch inference servers
 * across different models and deployments.
 */

export const BATCH_INFERENCE_ENDPOINTS: Record<string, string> = {
  // Llama models
  'llama-3.1-8b': process.env.BATCH_INFERENCE_URL_LLAMA || '',
  'meta-llama/Llama-3.1-8B-Instruct': process.env.BATCH_INFERENCE_URL_LLAMA || '',
  'meta-llama/Meta-Llama-3.1-8B-Instruct': process.env.BATCH_INFERENCE_URL_LLAMA || '',
  
  // Add more models here as needed
  // 'mistral-7b': process.env.BATCH_INFERENCE_URL_MISTRAL || '',
  // 'gpt-4': process.env.BATCH_INFERENCE_URL_GPT || '',
};

/**
 * Get the batch inference URL for a specific model
 * @param modelName - The model name (e.g., 'llama-3.1-8b', 'meta-llama/Llama-3.1-8B-Instruct')
 * @returns The batch inference server URL for the model
 * @throws Error if no endpoint is configured for the model
 */
export function getBatchInferenceUrl(modelName: string): string {
  // Normalize model name (case-insensitive lookup)
  const normalizedName = modelName.toLowerCase();
  
  // Try exact match first
  let url = BATCH_INFERENCE_ENDPOINTS[modelName];
  
  // Try case-insensitive match if exact match fails
  if (!url) {
    const entries = Object.entries(BATCH_INFERENCE_ENDPOINTS);
    const match = entries.find(([key]) => key.toLowerCase() === normalizedName);
    url = match?.[1] || '';
  }
  
  if (!url) {
    throw new Error(
      `No batch inference endpoint configured for model: ${modelName}. ` +
      `Available models: ${Object.keys(BATCH_INFERENCE_ENDPOINTS).join(', ')}`
    );
  }
  
  return url;
}

/**
 * Check if a model has a configured batch inference endpoint
 * @param modelName - The model name to check
 * @returns true if the model has a configured endpoint
 */
export function hasBatchInferenceEndpoint(modelName: string): boolean {
  try {
    getBatchInferenceUrl(modelName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all models that have configured batch inference endpoints
 * @returns Array of model names with configured endpoints
 */
export function getAvailableBatchModels(): string[] {
  return Object.keys(BATCH_INFERENCE_ENDPOINTS).filter(
    modelName => BATCH_INFERENCE_ENDPOINTS[modelName]
  );
}

