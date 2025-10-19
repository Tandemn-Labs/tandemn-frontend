import dbConnect from '../database';
import BatchInferenceTask, { IBatchInferenceTask } from '../models/BatchInferenceTask';
import { getUserAccount } from '../user-account-service';

export interface CreateBatchInferenceTaskParams {
  clerkUserId: string;
  taskId: string;
  modelName: string;
  inputFile: {
    path: string;
    columnName: string;
    delimiter?: string;
    totalLines?: number;
  };
  processingConfig: {
    systemPrompt: string;
    maxBufferSize: number;
    minBufferSize: number;
    startingId?: number;
    dryRun?: boolean;
  };
  samplingParams?: {
    maxCompletionTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    minP?: number;
    minTokens?: number;
    seed?: number;
    frequencyPenalty?: number;
    repetitionPenalty?: number;
    presencePenalty?: number;
    n?: number;
    eosTokenId?: number[];
    stop?: string[];
  };
  pipelineInfo?: {
    peerIds: string[];
    deploymentMap?: any;
  };
  metadata?: {
    userAgent?: string;
    apiVersion?: string;
    notes?: string;
    tags?: string[];
  };
}

export interface UpdateProgressParams {
  taskId: string;
  progress?: {
    linesProcessed?: number;
    batchesSent?: number;
    currentBufferSize?: number;
    lastProcessedLine?: number;
    nextBytePosition?: number;
    percentComplete?: number;
  };
  tokenMetrics?: {
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalTokens?: number;
  };
  performanceMetrics?: {
    linesPerSecond?: number;
    tokensPerSecond?: number;
    averageLatencyMs?: number;
    peakBufferSize?: number;
    totalBatches?: number;
  };
}

export interface CompleteTaskParams {
  taskId: string;
  outputFile?: {
    s3Path: string;
    s3Bucket?: string;
    s3Key?: string;
    fileSize?: number;
  };
  tokenMetrics?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    averageInputTokensPerRequest?: number;
    averageOutputTokensPerRequest?: number;
  };
  performanceMetrics?: {
    linesPerSecond?: number;
    tokensPerSecond?: number;
    averageLatencyMs?: number;
    peakBufferSize?: number;
    totalBatches: number;
  };
  costInfo?: {
    estimatedCostUSD: number;
    creditsCost: number;
    pricingModel: string;
  };
}

export interface FailTaskParams {
  taskId: string;
  errorMessage: string;
  errorType?: string;
  stackTrace?: string;
}

// Create a new batch inference task
export async function createBatchInferenceTask(
  params: CreateBatchInferenceTaskParams
): Promise<{ success: boolean; task?: IBatchInferenceTask; message: string }> {
  try {
    await dbConnect();

    // Get user account
    const account = await getUserAccount(params.clerkUserId);
    if (!account) {
      return { success: false, message: 'User account not found' };
    }

    // Create new task
    const task = new BatchInferenceTask({
      userId: account._id.toString(),
      clerkUserId: params.clerkUserId,
      taskId: params.taskId,
      modelName: params.modelName,
      inputFile: {
        path: params.inputFile.path,
        columnName: params.inputFile.columnName,
        delimiter: params.inputFile.delimiter || ',',
        totalLines: params.inputFile.totalLines,
      },
      processingConfig: {
        systemPrompt: params.processingConfig.systemPrompt,
        maxBufferSize: params.processingConfig.maxBufferSize,
        minBufferSize: params.processingConfig.minBufferSize,
        startingId: params.processingConfig.startingId || 0,
        dryRun: params.processingConfig.dryRun || false,
      },
      samplingParams: params.samplingParams || {},
      status: 'queued',
      progress: {
        linesProcessed: 0,
        batchesSent: 0,
        currentBufferSize: 0,
        lastProcessedLine: 0,
        nextBytePosition: 0,
      },
      tokenMetrics: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
      },
      performanceMetrics: {
        totalBatches: 0,
      },
      pipelineInfo: params.pipelineInfo || { peerIds: [] },
      metadata: params.metadata,
      queuedAt: new Date(),
    });

    await task.save();

    console.log(`✅ Created batch inference task: ${params.taskId}`);
    return { success: true, task, message: 'Task created successfully' };
  } catch (error) {
    console.error('Error creating batch inference task:', error);
    return { success: false, message: `Failed to create task: ${error}` };
  }
}

// Get a batch inference task by ID
export async function getBatchInferenceTask(taskId: string): Promise<IBatchInferenceTask | null> {
  try {
    await dbConnect();
    const task = await BatchInferenceTask.findOne({ taskId });
    return task;
  } catch (error) {
    console.error('Error getting batch inference task:', error);
    return null;
  }
}

// Update task progress
export async function updateBatchInferenceProgress(
  params: UpdateProgressParams
): Promise<{ success: boolean; task?: IBatchInferenceTask; message: string }> {
  try {
    await dbConnect();

    const updateData: any = {};

    // Update progress fields
    if (params.progress) {
      Object.keys(params.progress).forEach((key) => {
        updateData[`progress.${key}`] = params.progress![key as keyof typeof params.progress];
      });
    }

    // Update token metrics
    if (params.tokenMetrics) {
      Object.keys(params.tokenMetrics).forEach((key) => {
        updateData[`tokenMetrics.${key}`] = params.tokenMetrics![key as keyof typeof params.tokenMetrics];
      });
    }

    // Update performance metrics
    if (params.performanceMetrics) {
      Object.keys(params.performanceMetrics).forEach((key) => {
        updateData[`performanceMetrics.${key}`] = params.performanceMetrics![key as keyof typeof params.performanceMetrics];
      });
    }

    // Set status to processing if it's still queued
    const task = await BatchInferenceTask.findOne({ taskId: params.taskId });
    if (task && task.status === 'queued') {
      updateData.status = 'processing';
      updateData.startedAt = new Date();
    }

    const result = await BatchInferenceTask.findOneAndUpdate(
      { taskId: params.taskId },
      { $set: updateData },
      { new: true }
    );

    if (!result) {
      return { success: false, message: 'Task not found' };
    }

    return { success: true, task: result, message: 'Progress updated successfully' };
  } catch (error) {
    console.error('Error updating batch inference progress:', error);
    return { success: false, message: `Failed to update progress: ${error}` };
  }
}

// Complete a batch inference task
export async function completeBatchInferenceTask(
  params: CompleteTaskParams
): Promise<{ success: boolean; task?: IBatchInferenceTask; message: string }> {
  try {
    await dbConnect();

    const task = await BatchInferenceTask.findOne({ taskId: params.taskId });
    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    const completedAt = new Date();
    const totalDurationMs = task.startedAt 
      ? completedAt.getTime() - task.startedAt.getTime()
      : 0;

    const updateData: any = {
      status: 'completed',
      completedAt,
      totalDurationMs,
    };

    // Add output file info if provided
    if (params.outputFile) {
      // Parse S3 path to extract bucket and key
      let s3Bucket = params.outputFile.s3Bucket;
      let s3Key = params.outputFile.s3Key;

      if (!s3Bucket || !s3Key) {
        const s3Path = params.outputFile.s3Path;
        if (s3Path && s3Path.startsWith('s3://')) {
          const pathParts = s3Path.substring(5).split('/');
          s3Bucket = pathParts[0];
          s3Key = pathParts.slice(1).join('/');
        }
      }

      updateData['outputFile.s3Path'] = params.outputFile.s3Path;
      updateData['outputFile.s3Bucket'] = s3Bucket;
      updateData['outputFile.s3Key'] = s3Key;
      updateData['outputFile.fileSize'] = params.outputFile.fileSize;
    }

    // Update token metrics if provided
    if (params.tokenMetrics) {
      Object.keys(params.tokenMetrics).forEach((key) => {
        updateData[`tokenMetrics.${key}`] = params.tokenMetrics![key as keyof typeof params.tokenMetrics];
      });
    }

    // Update performance metrics if provided
    if (params.performanceMetrics) {
      Object.keys(params.performanceMetrics).forEach((key) => {
        updateData[`performanceMetrics.${key}`] = params.performanceMetrics![key as keyof typeof params.performanceMetrics];
      });
    }

    // Update cost info if provided
    if (params.costInfo) {
      updateData.costInfo = params.costInfo;
    }

    const updatedTask = await BatchInferenceTask.findOneAndUpdate(
      { taskId: params.taskId },
      { $set: updateData },
      { new: true }
    );

    console.log(`✅ Completed batch inference task: ${params.taskId}`);
    return { success: true, task: updatedTask, message: 'Task completed successfully' };
  } catch (error) {
    console.error('Error completing batch inference task:', error);
    return { success: false, message: `Failed to complete task: ${error}` };
  }
}

// Fail a batch inference task
export async function failBatchInferenceTask(
  params: FailTaskParams
): Promise<{ success: boolean; message: string }> {
  try {
    await dbConnect();

    const task = await BatchInferenceTask.findOne({ taskId: params.taskId });
    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    const completedAt = new Date();
    const totalDurationMs = task.startedAt 
      ? completedAt.getTime() - task.startedAt.getTime()
      : 0;

    await BatchInferenceTask.findOneAndUpdate(
      { taskId: params.taskId },
      {
        $set: {
          status: 'failed',
          completedAt,
          totalDurationMs,
          error: {
            message: params.errorMessage,
            timestamp: new Date(),
            type: params.errorType,
            stackTrace: params.stackTrace,
          },
        },
      }
    );

    console.log(`❌ Failed batch inference task: ${params.taskId}`);
    return { success: true, message: 'Task marked as failed' };
  } catch (error) {
    console.error('Error failing batch inference task:', error);
    return { success: false, message: `Failed to mark task as failed: ${error}` };
  }
}

// Get user's batch inference tasks
export async function getUserBatchInferenceTasks(
  clerkUserId: string,
  limit: number = 50
): Promise<IBatchInferenceTask[]> {
  try {
    await dbConnect();

    const tasks = await BatchInferenceTask.find({ clerkUserId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return tasks;
  } catch (error) {
    console.error('Error getting user batch inference tasks:', error);
    return [];
  }
}

