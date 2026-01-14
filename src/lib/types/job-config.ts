import { z } from 'zod';

// =========================
// Job Config Zod Schemas
// =========================
// TypeScript equivalents of the Python Pydantic models
// for NLP-based job config extraction

export const MetaConfigSchema = z.object({
  // A short description (max 100 characters) of the job
  description: z.string().max(100),
});

export const TaskConfigSchema = z.object({
  // type: batched_inference | online_serving | embeddings | image_generation
  type: z.enum(['batched_inference', 'online_serving', 'embeddings', 'image_generation']),
  // priority: low | normal | high | urgent
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

export const QuantizationConfigSchema = z.object({
  // bits: "4" | "8" | "16" | null
  bits: z.enum(['4', '8', '16']).nullable(),
});

export const FeatureConfigSchema = z.object({
  // true | false | null
  speculative_decode: z.boolean().nullable(),
  PD_disaggregation: z.boolean().nullable(),
});

export const VLLMConfigSchema = z.object({
  max_model_len: z.number().int().nullable(),
  trust_remote_code: z.boolean().nullable(),
  max_num_seqs: z.number().int().nullable(),
  max_num_batched_tokens: z.number().int().nullable(),
  config_format: z.enum(['auto', 'mistral']).nullable(),
  limit_mm_per_prompt: z.number().int().nullable(),
});

export const ModelConfigSchema = z.object({
  model_name: z.string().nullable(),
  // engine: vllm | sglang | diffusers | xDIT | not_specified
  engine: z.enum(['vllm', 'sglang', 'diffusers', 'xDIT', 'not_specified']),
  quantization: QuantizationConfigSchema,
  features: FeatureConfigSchema,
  vllm_config: VLLMConfigSchema,
});

export const OfflineSLOSchema = z.object({
  // deadline_hours: integer or null
  deadline_hours: z.number().int().nullable(),
});

export const SLOConfigSchema = z.object({
  // mode: offline | online (ALWAYS online for image_generation)
  mode: z.enum(['offline', 'online']),
  offline: OfflineSLOSchema.nullable(),
});

export const PlacementConfigSchema = z.object({
  // sku_preferences: GPU type or "not_specified"
  sku_preferences: z.string(),
});

export const JobConfigSchema = z.object({
  meta: MetaConfigSchema,
  task: TaskConfigSchema,
  model: ModelConfigSchema,
  slo: SLOConfigSchema,
  placement: PlacementConfigSchema,
});

// TypeScript types inferred from Zod schemas
export type MetaConfig = z.infer<typeof MetaConfigSchema>;
export type TaskConfig = z.infer<typeof TaskConfigSchema>;
export type QuantizationConfig = z.infer<typeof QuantizationConfigSchema>;
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type OfflineSLO = z.infer<typeof OfflineSLOSchema>;
export type SLOConfig = z.infer<typeof SLOConfigSchema>;
export type PlacementConfig = z.infer<typeof PlacementConfigSchema>;
export type JobConfig = z.infer<typeof JobConfigSchema>;

// =========================
// JSON Schema for OpenAI Structured Output
// =========================
// OpenAI requires a specific JSON schema format for structured outputs
// Note: OpenAI doesn't support 'oneOf', so we use strings for union types

export const JOB_CONFIG_JSON_SCHEMA = {
  name: 'job_config',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      meta: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'A short description (max 100 characters) of the job', maxLength: 100 },
        },
        required: ['description'],
        additionalProperties: false,
      },
      task: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['batched_inference', 'online_serving', 'embeddings', 'image_generation'] },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        },
        required: ['type', 'priority'],
        additionalProperties: false,
      },
      model: {
        type: 'object',
        properties: {
          model_name: { type: ['string', 'null'], description: 'Model name, or null if not specified' },
          engine: { type: 'string', enum: ['vllm', 'sglang', 'diffusers', 'xDIT', 'not_specified'] },
          quantization: {
            type: 'object',
            properties: {
              bits: { type: ['string', 'null'], enum: ['4', '8', '16', null], description: 'Quantization bits as string or null' },
            },
            required: ['bits'],
            additionalProperties: false,
          },
          features: {
            type: 'object',
            properties: {
              speculative_decode: { type: ['boolean', 'null'] },
              PD_disaggregation: { type: ['boolean', 'null'] },
            },
            required: ['speculative_decode', 'PD_disaggregation'],
            additionalProperties: false,
          },
          vllm_config: {
            type: 'object',
            properties: {
              max_model_len: { type: ['integer', 'null'] },
              trust_remote_code: { type: ['boolean', 'null'] },
              max_num_seqs: { type: ['integer', 'null'] },
              max_num_batched_tokens: { type: ['integer', 'null'] },
              config_format: { type: ['string', 'null'], enum: ['auto', 'mistral', null] },
              limit_mm_per_prompt: { type: ['integer', 'null'] },
            },
            required: [
              'max_model_len',
              'trust_remote_code',
              'max_num_seqs',
              'max_num_batched_tokens',
              'config_format',
              'limit_mm_per_prompt',
            ],
            additionalProperties: false,
          },
        },
        required: ['model_name', 'engine', 'quantization', 'features', 'vllm_config'],
        additionalProperties: false,
      },
      slo: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['offline', 'online'] },
          offline: {
            type: ['object', 'null'],
            properties: {
              deadline_hours: { type: ['integer', 'null'], description: 'Deadline in hours or null' },
            },
            required: ['deadline_hours'],
            additionalProperties: false,
          },
        },
        required: ['mode', 'offline'],
        additionalProperties: false,
      },
      placement: {
        type: 'object',
        properties: {
          sku_preferences: { type: 'string', description: 'GPU type like "H100", "A100", "L40S" or "not_specified"' },
        },
        required: ['sku_preferences'],
        additionalProperties: false,
      },
    },
    required: ['meta', 'task', 'model', 'slo', 'placement'],
    additionalProperties: false,
  },
} as const;

