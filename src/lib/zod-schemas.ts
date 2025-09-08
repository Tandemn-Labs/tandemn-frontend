import { z } from 'zod';

export const modelsQuerySchema = z.object({
  q: z.string().optional(),
  modalities: z.array(z.enum(['text', 'image', 'file', 'audio'])).optional(),
  series: z.array(z.enum(['GPT', 'Claude', 'Gemini', 'Mistral', 'Llama', 'Other'])).optional(),
  contextMin: z.coerce.number().min(0).optional(),
  contextMax: z.coerce.number().min(0).optional(),
  promptPriceMax: z.coerce.number().min(0).optional(),
  sort: z.enum(['popularity', 'latency', 'priceLow', 'priceHigh', 'name']).optional(),
  view: z.enum(['list', 'grid']).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const chatSendSchema = z.object({
  modelId: z.string(),
  roomId: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
});

export const createRoomSchema = z.object({
  title: z.string().optional(),
  modelId: z.string(),
});

export const externalChatCompletionSchema = z.object({
  model: z.string(),
  stream: z.boolean(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  max_completion_tokens: z.number().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  min_p: z.number().optional(),
  min_tokens: z.number().optional(),
  seed: z.number().optional(),
  frequency_penalty: z.number().optional(),
  repetition_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  n: z.number().optional(),
  eos_token_id: z.array(z.number()).optional(),
  stop: z.array(z.string()).optional(),
});
