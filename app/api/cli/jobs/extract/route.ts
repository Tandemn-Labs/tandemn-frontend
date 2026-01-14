import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { validateCliSession } from '@/lib/cli-session';
import { JobConfigSchema, JOB_CONFIG_JSON_SCHEMA, type JobConfig } from '@/lib/types/job-config';

/**
 * POST /api/cli/jobs/extract
 * 
 * CLI job config extraction endpoint - uses NLP to extract structured job config
 * from a natural language prompt
 * 
 * Request headers:
 * Authorization: Bearer <sessionToken>
 * 
 * Request body:
 * {
 *   "prompt": "I need to run a batch inference job with llama-70b using AWQ quantization, deadline 24 hours"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "config": {
 *     "meta": { "description": "Batch llama-70b AWQ" },
 *     "task": { "type": "batched_inference", "priority": "normal" },
 *     ...
 *   }
 * }
 */

const SYSTEM_PROMPT = `
You are a job configuration extractor. Your task is to parse user requests and fill a structured JobConfig schema.

CRITICAL RULES:
1. Extract ONLY what the user explicitly mentions
2. Use "not_specified" for any field not mentioned by the user
3. Do NOT infer, suggest, or add information beyond what is stated
4. Output must be valid JSON matching the JobConfig schema exactly

SCHEMA STRUCTURE:

JobConfig:
  meta:
    description: string (max 100 chars, summarize the job)
  
  task:
    type: "batched_inference" | "online_serving" | "embeddings" | "image_generation"
    priority: "low" | "normal" | "high" | "urgent"
  
  model:
    model_name: string 
    engine: "vllm" | "sglang" | "diffusers" | "xDIT" | "not_specified"
    quantization:
      bits: enum [4, 8 or None]
    features:
      speculative_decode: true | false
      PD_disaggregation: true | false
    vllm_config:
      max_model_len: integer | null
      trust_remote_code: boolean | null
      max_num_seqs: integer | null
      max_num_batched_tokens: integer | null
      config_format: "auto" | "mistral" | null
      limit_mm_per_prompt: integer | null
  
  slo:
    mode: "offline" | "online"
    offline:
      deadline_hours: integer | None (only if mode is offline)
  
  placement:
    sku_preferences: string (e.g., "H100", "A100,H100", or "not_specified")

EXTRACTION LOGIC:

Task Type Detection:
- Keywords "batch", "batched inference", "offline processing" → batched_inference
- Keywords "serve", "online", "API", "streaming" → online_serving
- Keywords "embeddings", "vectors", "similarity" → embeddings
- Keywords "image generation", "text-to-image", "stable diffusion" → image_generation

Task Priority:
- If online_serving OR image_generation → "urgent"
- If batched_inference with deadline:
  - deadline >= 48 hours → "low"
  - 8 <= deadline < 48 hours → "normal"
  - deadline < 8 hours → "high"
- If no deadline mentioned → "normal"

Engine Selection:
- If batched_inference OR online_serving OR embeddings:
  - Default to "vllm" if no engine mentioned
  - Accept "sglang" if explicitly stated
- If image_generation:
  - Default to "diffusers"
  - Accept "xDIT" if explicitly stated
- Otherwise → "not_specified"

Model Name:
- For other task types: extract the exact model name mentioned
- If no model mentioned: null

SLO Mode:
- image_generation → always "online"
- online_serving → always "online"
- batched_inference → "offline"
- embeddings → "offline" (unless user says online)

vLLM Specific Config:
- ONLY fill these fields if engine is "vllm"
- max_model_len: extract if mentioned (e.g., "4k context", "8192 tokens")
- trust_remote_code: true if user mentions custom/trust code, else null
- max_num_seqs: extract if mentioned (e.g., "256 sequences", "batch size 128")
- max_num_batched_tokens: extract if mentioned
- config_format: "mistral" if model contains "mistral", "mixtral", "ministral", "devstral", else "auto" 
- limit_mm_per_prompt: extract if multimodal limits mentioned, else null
- If engine is NOT vllm, set all vllm_specific_config fields to null

Quantization:
- Extract bit width if mentioned: "4-bit" → "4", "8-bit" → "8", "16-bit" → "16"
- If not mentioned at all: null

Features:
- speculative_decode: true only if explicitly mentioned, false if explicitly disabled, null otherwise
There is no Speculative Decoding in Image Generation Frameworks and Models
- PD_disaggregation: true only if explicitly mentioned, false if explicitly disabled, null otherwise
There is no PD_disaggregation in Image Generation Frameworks and Models

Placement:
- Extract GPU types: "H100", "A100", "L40S", etc.
- Multiple GPUs: comma-separated "A100,H100"
- If not mentioned: "not_specified"

VALIDATION CHECKLIST:
- meta.description is concise and descriptive
- task.type matches one of the four allowed values
- task.priority is appropriate for the SLO mode and deadline
- model.engine matches task type compatibility (vllm/sglang for inference, diffusers/xDIT for images)
- vllm_specific_config is only filled when engine is "vllm", otherwise all null
- slo.mode is "online" for online_serving and image_generation
- All unmentioned fields use null appropriately
- If a person wants Image generation and they want either PD_disaggregation or SpeculativeDecoding, just put null

Now extract the configuration from the user's request.
`;

export async function POST(request: NextRequest) {
  try {
    // Extract session token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing authorization',
          message: 'Authorization header with Bearer token is required'
        },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate session token
    const session = await validateCliSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired session',
          message: 'The session token is invalid or has expired'
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request',
          message: 'A prompt string is required'
        },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return NextResponse.json(
        { 
          success: false,
          error: 'OpenAI not configured',
          message: 'The OpenAI API is not properly configured'
        },
        { status: 503 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Call OpenAI with structured output
    const response = await openai.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: JOB_CONFIG_JSON_SCHEMA.name,
          schema: JOB_CONFIG_JSON_SCHEMA.schema,
          strict: JOB_CONFIG_JSON_SCHEMA.strict,
        },
      },
    });

    const responseData = response as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const content =
      responseData.output_text ??
      responseData.output?.[0]?.content?.find((item) => item.type === 'output_text')?.text ??
      responseData.output?.[0]?.content?.[0]?.text;

    if (!content) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Empty response',
          message: 'OpenAI returned an empty response'
        },
        { status: 500 }
      );
    }

    // Parse and validate the response
    let parsedConfig: JobConfig;
    try {
      const rawConfig = JSON.parse(content);
      parsedConfig = JobConfigSchema.parse(rawConfig);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid config format',
          message: 'Failed to parse the extracted configuration',
          details: parseError instanceof Error ? parseError.message : String(parseError)
        },
        { status: 500 }
      );
    }

    // Return the extracted config
    return NextResponse.json({
      success: true,
      config: parsedConfig,
    });

  } catch (error) {
    console.error('Error extracting job config:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

