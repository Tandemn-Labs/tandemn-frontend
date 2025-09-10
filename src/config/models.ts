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
    provider: "Tandemn",
    description: "The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperforms many of the available open source and closed chat models on common industry benchmarks. Supported languages: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai.",
    context_length: 8192 ,
    input_price_per_1m: 0.038,   // $0.80 per 1M input tokens
    output_price_per_1m: 0.12,  // $0.80 per 1M output tokens
    capabilities: ["text", "reasoning", "coding", "fast-inference"],
    max_tokens: 2000,
    is_available: true  // Model available through fallback system
  },
  {
    id: "deepseek/deepseek-r1-distill-llama-70b",
    name: "DeepSeek: R1 Distill Llama 70B",
    provider: "Tandemn",
    description: "DeepSeek R1 Distill Llama 70B is a distilled large language model based on Llama-3.3-70B-Instruct, using outputs from DeepSeek R1. The model combines advanced distillation techniques to achieve high performance across multiple benchmarks, including: AIME 2024 pass@1: 70., MATH-500 pass@1: 94.5, CodeForces Rating: 1633. The model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models.",
    context_length: 8192,
    input_price_per_1m: 0.026,
    output_price_per_1m: 0.104,
    capabilities: ["text", "reasoning", "coding", "analysis"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "mistralai/devstral-small-2507",
    name: "Devstral Small 2507 ",
    provider: "Tandemn",
    description: "Devstral-Small-2507 is a 24B parameter agentic LLM fine-tuned from Mistral-Small-3.1, jointly developed by Mistral AI and All Hands AI for advanced software engineering tasks. It is optimized for codebase exploration, multi-file editing, and integration into coding agents, achieving state-of-the-art results on SWE-Bench Verified (46.8%). Devstral supports a 128k context window and uses a custom Tekken tokenizer. It is text-only, with the vision encoder removed, and is suitable for local deployment on high-end consumer hardware (e.g., RTX 4090, 32GB RAM Macs). Devstral is best used in agentic workflows via the OpenHands scaffold and is compatible with inference frameworks like vLLM, Transformers, and Ollama. It is released under the Apache 2.0 license.",
    context_length: 8192,
    input_price_per_1m: 0.02,
    output_price_per_1m: 0.08,
    capabilities: ["text", "reasoning", "coding", "fast-inference"],
    max_tokens: 4096,
    is_available: true
  },
  {
    id: "qwen/qwen3-32b",
    name: "Qwen: Qwen3 32B",
    provider: "Tandemn",
    description: "Qwen3-32B is a dense 32.8B parameter causal language model from the Qwen3 series, optimized for both complex reasoning and efficient dialogue. It supports seamless switching between a thinking mode for tasks like math, coding, and logical inference, and a non-thinking mode for faster, general-purpose conversation. The model demonstrates strong performance in instruction-following, agent tool use, creative writing, and multilingual tasks across 100+ languages and dialects. It natively handles 32K token contexts and can extend to 131K tokens using YaRN-based scaling.",
    context_length: 8192,
    input_price_per_1m: 0.018,
    output_price_per_1m: 0.072,
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