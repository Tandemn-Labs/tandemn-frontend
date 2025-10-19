import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createBatchInferenceTask } from '@/lib/services/batch-inference-service';

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

    // Validate required environment variable
    const BATCH_INFERENCE_BASE_URL = process.env.BATCH_INFERENCE_BASE_URL;
    if (!BATCH_INFERENCE_BASE_URL) {
      console.error('❌ BATCH_INFERENCE_BASE_URL environment variable is not set');
      return NextResponse.json(
        { error: 'Batch inference service is not configured' },
        { status: 503 }
      );
    }

    console.log('👤 User authenticated:', userId);

    // Get the request body
    const body = await request.json();
    
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

