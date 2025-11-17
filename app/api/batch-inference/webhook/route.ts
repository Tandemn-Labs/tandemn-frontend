import { NextRequest, NextResponse } from 'next/server';
import {
  updateBatchInferenceProgress,
  completeBatchInferenceTask,
  failBatchInferenceTask,
  getBatchInferenceTask,
} from '@/lib/services/batch-inference-service';
import { calculateBatchCost } from '@/config/batch-pricing';

// Optional: Add a secret key for webhook authentication
const WEBHOOK_SECRET = process.env.BATCH_INFERENCE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook secret
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get('authorization');
      const providedSecret = authHeader?.replace('Bearer ', '');
      
      if (providedSecret !== WEBHOOK_SECRET) {
        console.error('Invalid webhook secret');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const { action, taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    console.log(`📡 Webhook received: ${action} for task ${taskId}`);

    // Handle different webhook actions
    switch (action) {
      case 'progress':
        // Update task progress
        const progressResult = await updateBatchInferenceProgress({
          taskId,
          progress: {
            linesProcessed: body.lines_processed,
            batchesSent: body.batches_sent,
            currentBufferSize: body.current_buffer_size,
            lastProcessedLine: body.last_processed_line,
            nextBytePosition: body.next_byte_position,
            percentComplete: body.percent_complete,
          },
          tokenMetrics: body.token_metrics ? {
            totalInputTokens: body.token_metrics.total_input_tokens,
            totalOutputTokens: body.token_metrics.total_output_tokens,
            totalTokens: body.token_metrics.total_tokens,
          } : undefined,
          performanceMetrics: body.performance_metrics ? {
            linesPerSecond: body.performance_metrics.lines_per_second,
            tokensPerSecond: body.performance_metrics.tokens_per_second,
            averageLatencyMs: body.performance_metrics.average_latency_ms,
            peakBufferSize: body.performance_metrics.peak_buffer_size,
            totalBatches: body.performance_metrics.total_batches,
          } : undefined,
        });

        if (!progressResult.success) {
          return NextResponse.json(
            { error: progressResult.message },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Progress updated',
        });

      case 'complete':
        // Mark task as completed
        if (!body.s3_path) {
          return NextResponse.json(
            { error: 's3_path is required for completion' },
            { status: 400 }
          );
        }

        // Get the task to retrieve model name
        const task = await getBatchInferenceTask(taskId);
        if (!task) {
          return NextResponse.json(
            { error: 'Task not found' },
            { status: 404 }
          );
        }

        // Calculate actual cost based on token metrics
        let actualCost = 0;
        let actualCostInfo = undefined;
        
        if (body.token_metrics && body.token_metrics.total_input_tokens && body.token_metrics.total_output_tokens) {
          actualCost = calculateBatchCost(
            task.modelName,
            body.token_metrics.total_input_tokens,
            body.token_metrics.total_output_tokens
          );
          
          actualCostInfo = {
            estimatedCostUSD: actualCost,
            creditsCost: actualCost,
            pricingModel: 'together-batch-25discount',
          };
          
          console.log(`💰 Calculated actual cost for task ${taskId}: $${actualCost.toFixed(4)}`);
          console.log(`   Input tokens: ${body.token_metrics.total_input_tokens}, Output tokens: ${body.token_metrics.total_output_tokens}`);
          
          // Log comparison with estimated cost if available
          if (task.estimatedCostInfo) {
            const estimatedCost = task.estimatedCostInfo.creditsCost;
            const difference = actualCost - estimatedCost;
            const percentDiff = ((difference / estimatedCost) * 100).toFixed(1);
            console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}, Difference: $${difference.toFixed(4)} (${percentDiff}%)`);
          }
        }

        const completeResult = await completeBatchInferenceTask({
          taskId,
          outputFile: {
            s3Path: body.s3_path,
            s3Bucket: body.s3_bucket,
            s3Key: body.s3_key,
            fileSize: body.file_size,
          },
          tokenMetrics: body.token_metrics ? {
            totalInputTokens: body.token_metrics.total_input_tokens,
            totalOutputTokens: body.token_metrics.total_output_tokens,
            totalTokens: body.token_metrics.total_tokens,
            averageInputTokensPerRequest: body.token_metrics.average_input_tokens_per_request,
            averageOutputTokensPerRequest: body.token_metrics.average_output_tokens_per_request,
          } : undefined,
          performanceMetrics: body.performance_metrics ? {
            linesPerSecond: body.performance_metrics.lines_per_second,
            tokensPerSecond: body.performance_metrics.tokens_per_second,
            averageLatencyMs: body.performance_metrics.average_latency_ms,
            peakBufferSize: body.performance_metrics.peak_buffer_size,
            totalBatches: body.performance_metrics.total_batches,
          } : undefined,
          costInfo: actualCostInfo, // Use calculated cost instead of backend-provided cost
        });

        if (!completeResult.success) {
          return NextResponse.json(
            { error: completeResult.message },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Task marked as completed',
        });

      case 'fail':
        // Mark task as failed
        if (!body.error_message) {
          return NextResponse.json(
            { error: 'error_message is required for failure' },
            { status: 400 }
          );
        }

        const failResult = await failBatchInferenceTask({
          taskId,
          errorMessage: body.error_message,
          errorType: body.error_type,
          stackTrace: body.stack_trace,
        });

        if (!failResult.success) {
          return NextResponse.json(
            { error: failResult.message },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Task marked as failed',
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

