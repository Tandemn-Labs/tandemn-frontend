import { z } from 'zod';

// =========================
// Job Config Zod Schemas
// =========================
// TypeScript equivalents of the Python Pydantic models
// for NLP-based job config extraction

export const MetaConfigSchema = z.object({
  // A short description (about 20 characters) of the job
  description: z.string(),
});

export const TaskConfigSchema = z.object({
  // type: batched_inference | online_serving | embeddings | image_generation
  type: z.enum(['batched_inference', 'online_serving', 'embeddings', 'image_generation']),
  // priority: low | normal | high | urgent
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

export const QuantizationConfigSchema = z.object({
  // method: none | int8 | gptq | awq | gguf | a8w8 | w4a8 | not_specified
  method: z.enum(['none', 'int8', 'gptq', 'awq', 'gguf', 'a8w8', 'w4a8', 'not_specified']),
  // bits: string so we can also support "not_specified"
  bits: z.string(), // e.g. "8", "4", "not_specified"
});

export const FeatureConfigSchema = z.object({
  // true | false | not_specified
  speculative_decode: z.enum(['true', 'false', 'not_specified']),
  continuous_batching: z.enum(['true', 'false', 'not_specified']),
  PD_disaggregation: z.enum(['true', 'false', 'not_specified']),
});

export const ModelConfigSchema = z.object({
  model_name: z.string().nullable().optional(),
  // engine: vllm | sglang | diffusers | xDIT | not_specified
  engine: z.enum(['vllm', 'sglang', 'diffusers', 'xDIT', 'not_specified']),
  // tokenizer: huggingface | mistral | not_specified
  tokenizer: z.enum(['huggingface', 'mistral', 'not_specified']),
  // string: either a number as string or "not_specified"
  max_context: z.string(),
  max_model_len: z.string(),
  // dtype: fp32 | bf16 | fp16 | fp8 | fp4 | int8 | int4 | not_specified
  dtype: z.enum(['fp32', 'bf16', 'fp16', 'fp8', 'fp4', 'int8', 'int4', 'not_specified']),
  quantization: QuantizationConfigSchema,
  features: FeatureConfigSchema,
});

export const OfflineSLOSchema = z.object({
  // deadline_hours: required for batched_inference
  // Use "not_specified" if not told. String: either a number as string or "not_specified"
  deadline_hours: z.string(),
});

export const SLOConfigSchema = z.object({
  // mode: offline | online (ALWAYS online for image_generation)
  mode: z.enum(['offline', 'online']),
  offline: OfflineSLOSchema.nullable().optional(),
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
          description: { type: 'string', description: 'A short description (about 20 characters) of the job' },
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
          model_name: { type: ['string', 'null'], description: 'Model name, or null for batched_inference' },
          engine: { type: 'string', enum: ['vllm', 'sglang', 'diffusers', 'xDIT', 'not_specified'] },
          tokenizer: { type: 'string', enum: ['huggingface', 'mistral', 'not_specified'] },
          // Use string for max_context - can be a number as string or "not_specified"
          max_context: { type: 'string', description: 'Integer as string (e.g. "8192") or "not_specified"' },
          max_model_len: { type: 'string', description: 'Integer as string (e.g. "4096") or "not_specified"' },
          dtype: { type: 'string', enum: ['fp32', 'bf16', 'fp16', 'fp8', 'fp4', 'int8', 'int4', 'not_specified'] },
          quantization: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: ['none', 'int8', 'gptq', 'awq', 'gguf', 'a8w8', 'w4a8', 'not_specified'] },
              bits: { type: 'string', description: 'e.g. "8", "4", or "not_specified"' },
            },
            required: ['method', 'bits'],
            additionalProperties: false,
          },
          features: {
            type: 'object',
            properties: {
              speculative_decode: { type: 'string', enum: ['true', 'false', 'not_specified'] },
              continuous_batching: { type: 'string', enum: ['true', 'false', 'not_specified'] },
              PD_disaggregation: { type: 'string', enum: ['true', 'false', 'not_specified'] },
            },
            required: ['speculative_decode', 'continuous_batching', 'PD_disaggregation'],
            additionalProperties: false,
          },
        },
        required: ['model_name', 'engine', 'tokenizer', 'max_context', 'max_model_len', 'dtype', 'quantization', 'features'],
        additionalProperties: false,
      },
      slo: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['offline', 'online'] },
          offline: {
            type: ['object', 'null'],
            properties: {
              // Use string for deadline_hours - can be a number as string or "not_specified"
              deadline_hours: { type: 'string', description: 'Integer as string (e.g. "24") or "not_specified"' },
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

