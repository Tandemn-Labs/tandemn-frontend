import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createBatchInferenceTask } from '@/lib/services/batch-inference-service';
import { getBatchInferenceUrl } from '@/config/batch-inference-endpoints';
import { estimateBatchCost } from '@/config/batch-pricing';
import { getUserCredits } from '@/lib/user-account-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Environment check:');
    console.log('  MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('  MONGODB_URI preview:', process.env.MONGODB_URI?.substring(0, 50) + '...');
    
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('👤 User authenticated:', userId);

    // Get the request body
    const body = await request.json();
    
    // Get the batch inference URL for the specified model
    let BATCH_INFERENCE_BASE_URL: string;
    try {
      BATCH_INFERENCE_BASE_URL = getBatchInferenceUrl(body.model_name);
    } catch (error) {
      console.error('❌ Error getting batch inference URL:', error);
      return NextResponse.json(
        { 
          error: 'Batch inference not available for this model',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 400 }
      );
    }

    // Calculate estimated cost and check user credits
    const totalLines = body.total_lines || 1000; // Default estimate if not provided
    const estimatedCost = estimateBatchCost(body.model_name, totalLines);
    
    console.log(`💰 Estimated cost for ${totalLines} lines: $${estimatedCost.toFixed(4)}`);
    
    // Check user credits
    const userCredits = await getUserCredits(userId);
    if (userCredits < estimatedCost) {
      console.log(`❌ Insufficient credits. Required: $${estimatedCost.toFixed(4)}, Available: $${userCredits.toFixed(4)}`);
      return NextResponse.json(
        { 
          error: `Insufficient credits for batch inference. Required: $${estimatedCost.toFixed(2)}, Available: $${userCredits.toFixed(2)}`,
          credits_required: estimatedCost,
          credits_available: userCredits,
          estimated_lines: totalLines,
        },
        { status: 402 } // Payment Required
      );
    }
    
    console.log(`✅ User has sufficient credits: $${userCredits.toFixed(4)} >= $${estimatedCost.toFixed(4)}`);
    
    console.log('Proxying batch inference request:', {
      model_name: body.model_name,
      path_of_csv: body.path_of_csv,
      starting_id: body.starting_id,
      userId
    });

    // Forward the request to the batch inference server
    const response = await fetch(`${BATCH_INFERENCE_BASE_URL}/infer_batched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Batch inference server error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Batch inference server error',
          details: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Batch inference started successfully:', result);

    // Create MongoDB record for tracking
    if (result.task_id) {
      console.log('💾 Creating MongoDB record for task:', result.task_id);
      console.log('Task data:', {
        userId,
        taskId: result.task_id,
        modelName: body.model_name,
        path: body.path_of_csv,
        columnName: body.name_of_column,
      });
      
      try {
        const taskCreation = await createBatchInferenceTask({
          clerkUserId: userId,
          taskId: result.task_id,
          modelName: body.model_name,
          inputFile: {
            path: body.path_of_csv,
            columnName: body.name_of_column,
            delimiter: body.delimiter || ',',
            totalLines: body.total_lines,
          },
          processingConfig: {
            systemPrompt: body.system_prompt,
            maxBufferSize: body.max_buffer_size || 1000,
            minBufferSize: body.min_buffer_size || 500,
            startingId: body.starting_id || 0,
            dryRun: body.dry_run || false,
          },
          samplingParams: {
            maxCompletionTokens: body.max_completion_tokens,
            temperature: body.temperature,
            topP: body.top_p,
            topK: body.top_k,
            minP: body.min_p,
            minTokens: body.min_tokens,
            seed: body.seed,
            frequencyPenalty: body.frequency_penalty,
            repetitionPenalty: body.repetition_penalty,
            presencePenalty: body.presence_penalty,
            n: body.n,
            eosTokenId: body.eos_token_id,
            stop: body.stop,
          },
          estimatedCostInfo: {
            estimatedCostUSD: estimatedCost,
            creditsCost: estimatedCost,
            pricingModel: 'together-batch-25discount',
          },
          metadata: {
            userAgent: request.headers.get('user-agent') || undefined,
            apiVersion: 'v1',
          },
        });

        if (!taskCreation.success) {
          console.error('❌ Failed to create MongoDB task record:', taskCreation.message);
          console.error('Full error:', taskCreation);
          // Don't fail the request, just log the error
        } else {
          console.log(`✅ Created MongoDB record for task ${result.task_id}`);
          console.log('Task document ID:', taskCreation.task?._id);
        }
      } catch (error) {
        console.error('❌ Exception while creating MongoDB record:', error);
      }
    } else {
      console.warn('⚠️  No task_id in response from backend, cannot create MongoDB record');
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error proxying batch inference request:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Cannot connect to batch inference server',
          details: 'The batch inference server is not responding. Please check if the server is running.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

