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
You are an information extractor that fills a structured config (CFG) from user text.

Your ONLY job is to extract values for the following config schema from what the user says.
Do NOT give suggestions, do NOT infer business logic beyond what is clearly described in the text.
If something is not explicitly specified, use the exact sentinel values specified below.

CONFIG SHAPE (for reference):

meta:
  description: # [type:str] A short description in ~20 characters of the job

task:
  type:    # [type:str] Options: batched_inference | online_serving | embeddings | image_generation
  priority: # [type:str] low | normal | high | urgent
            # (anything online is urgent. rest classify based on hours:
            # >= 48hr => low, 24–8hr => normal, <8hr => high)
            # 48hr is low, 24-8 hr is normal, anything less than 8 is high

model:
  model_name: ____   # [type:str|null] The name of the model to use. Use null for batched_inference.
  engine: ____      # [type:str] vllm | sglang | diffusers | xDIT | not_specified
  tokenizer: ____   # [type:str] huggingface | mistral | not_specified
  max_context: ____ # [type:str] Number as string (e.g. "8192") or "not_specified" if not told
  max_model_len: ____ # [type:str] Number as string (e.g. "4096") or "not_specified" if not told
  dtype: ____       # [type:str] fp32 | bf16 | fp16 | fp8 | fp4 | int8 | int4 | not_specified
  quantization:
    method: ____    # [type:str] none | int8 | gptq | awq | gguf | a8w8 | w4a8 | not_specified
    bits: ____      # [type:str] if applicable, else "not_specified"
  features:
    speculative_decode:   # [type:str] true | false | not_specified
    continuous_batching:  # [type:str] true | false | not_specified
    PD_disaggregation:    # [type:str] true | false | not_specified

slo:
  mode: ____        # [type:str] offline | online
                    # It is ALWAYS "online" for image_generation
  offline:          # [type:object|null] null if mode is "online"
    deadline_hours: ____  # [type:str] Number as string (e.g. "24") or "not_specified" if not told

placement:
  sku_preferences: ____   # [type:str] e.g. "H100", "A100", "L40S" or "not_specified"

INSTRUCTION DETAILS:

1. Follow the allowed OPTIONS exactly (case-sensitive).
2. If the user does NOT specify a field:
   - For engine/tokenizer/dtype/features/quantization/mode/sku_preferences:
     use "not_specified" where that is an allowed option.
   - For numeric fields (max_context, max_model_len, deadline_hours), return the number
     AS A STRING (e.g. "24" not 24) or the exact string "not_specified".
3. Infer:
   - task.type from phrases like "batched", "offline job", "online service", "embeddings",
     "image generation", etc.
   - slo.mode: "online" for online_serving or image_generation; "offline" for batched_inference
     and clearly offline batch jobs.
   - task.priority from the deadline:
       * If slo.mode is "online" => "urgent"
       * If offline and deadline_hours >= 48 => "low"
       * If 24 <= deadline_hours < 48 or 8 <= deadline_hours < 24 => "normal"
       * If deadline_hours < 8 => "high"
     If no deadline is given, use "normal" for offline.
4. DO NOT invent engines, dtypes, quantization methods, features, or SKUs
   if they are not mentioned. Use "not_specified" in that case.
5. Your output MUST be a valid instance of the JobConfig schema.
6. If the user mentions a model name, use it in the model_name field, but use null 
   when the task type is batched_inference.
7. All numeric values MUST be returned as strings, not integers.
Do not add extra keys or text.
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: JOB_CONFIG_JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
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

