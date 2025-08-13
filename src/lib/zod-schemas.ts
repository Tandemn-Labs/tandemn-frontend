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
