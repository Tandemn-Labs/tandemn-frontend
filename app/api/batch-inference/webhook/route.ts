import { NextRequest, NextResponse } from 'next/server';
import {
  updateBatchInferenceProgress,
  completeBatchInferenceTask,
  failBatchInferenceTask,
} from '@/lib/services/batch-inference-service';

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
          costInfo: body.cost_info ? {
            estimatedCostUSD: body.cost_info.estimated_cost_usd,
            creditsCost: body.cost_info.credits_cost,
            pricingModel: body.cost_info.pricing_model,
          } : undefined,
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

