import mongoose, { Document, Schema } from 'mongoose';

export interface IBatchInferenceTask extends Document {
  _id: string;
  
  // User & Model Information
  userId: string;              // MongoDB UserAccount _id
  clerkUserId: string;         // Clerk user ID
  taskId: string;              // UUID from the backend
  modelName: string;           // Model used for inference
  
  // Input Configuration
  inputFile: {
    path: string;              // S3 or local path to input CSV
    columnName: string;        // Column being processed
    delimiter: string;         // CSV delimiter
    totalLines?: number;       // Total lines in file (if known)
  };
  
  // Processing Configuration
  processingConfig: {
    systemPrompt: string;
    maxBufferSize: number;
    minBufferSize: number;
    startingId: number;
    dryRun: boolean;
  };
  
  // Sampling Parameters (vLLM)
  samplingParams: {
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
  
  // Status & Progress
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    linesProcessed: number;
    batchesSent: number;
    currentBufferSize: number;
    lastProcessedLine: number;
    nextBytePosition: number;
    percentComplete?: number;
  };
  
  // Timing Information
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  totalDurationMs?: number;
  
  // Token Metrics
  tokenMetrics: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    averageInputTokensPerRequest?: number;
    averageOutputTokensPerRequest?: number;
  };
  
  // Performance Metrics
  performanceMetrics: {
    linesPerSecond?: number;
    tokensPerSecond?: number;
    averageLatencyMs?: number;
    peakBufferSize?: number;
    totalBatches: number;
  };
  
  // Results - Store only the S3 path, generate presigned URLs on-demand
  outputFile: {
    s3Path?: string;           // Full S3 URI (e.g., s3://bucket/results/file.csv)
    s3Bucket?: string;         // Bucket name for easy access
    s3Key?: string;            // Key within bucket
    fileSize?: number;         // Size in bytes
  };
  
  // Pipeline Information
  pipelineInfo: {
    peerIds: string[];
    deploymentMap?: any;
  };
  
  // Error Tracking
  error?: {
    message: string;
    timestamp: Date;
    peerId?: string;
    stackTrace?: string;
  };
  
  // Cost Tracking (if applicable)
  costInfo?: {
    estimatedCostUSD: number;
    creditsCost: number;
    pricingModel: string;
  };
  
  // Metadata
  metadata?: {
    userAgent?: string;
    apiVersion?: string;
    notes?: string;
    tags?: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const BatchInferenceTaskSchema = new Schema<IBatchInferenceTask>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  clerkUserId: {
    type: String,
    required: true,
    index: true,
  },
  taskId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  modelName: {
    type: String,
    required: true,
    index: true,
  },
  
  // Input Configuration
  inputFile: {
    path: { type: String, required: true },
    columnName: { type: String, required: true },
    delimiter: { type: String, default: ',' },
    totalLines: Number,
  },
  
  // Processing Configuration
  processingConfig: {
    systemPrompt: { type: String, required: true },
    maxBufferSize: { type: Number, required: true },
    minBufferSize: { type: Number, required: true },
    startingId: { type: Number, default: 0 },
    dryRun: { type: Boolean, default: false },
  },
  
  // Sampling Parameters
  samplingParams: {
    maxCompletionTokens: Number,
    temperature: Number,
    topP: Number,
    topK: Number,
    minP: Number,
    minTokens: Number,
    seed: Number,
    frequencyPenalty: Number,
    repetitionPenalty: Number,
    presencePenalty: Number,
    n: Number,
    eosTokenId: [Number],
    stop: [String],
  },
  
  // Status & Progress
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
    required: true,
    default: 'queued',
    index: true,
  },
  progress: {
    linesProcessed: { type: Number, default: 0 },
    batchesSent: { type: Number, default: 0 },
    currentBufferSize: { type: Number, default: 0 },
    lastProcessedLine: { type: Number, default: 0 },
    nextBytePosition: { type: Number, default: 0 },
    percentComplete: Number,
  },
  
  // Timing
  queuedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  startedAt: Date,
  completedAt: Date,
  totalDurationMs: Number,
  
  // Token Metrics
  tokenMetrics: {
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    averageInputTokensPerRequest: Number,
    averageOutputTokensPerRequest: Number,
  },
  
  // Performance Metrics
  performanceMetrics: {
    linesPerSecond: Number,
    tokensPerSecond: Number,
    averageLatencyMs: Number,
    peakBufferSize: Number,
    totalBatches: { type: Number, default: 0 },
  },
  
  // Results
  outputFile: {
    s3Path: String,
    s3Bucket: String,
    s3Key: String,
    fileSize: Number,
  },
  
  // Pipeline Information
  pipelineInfo: {
    peerIds: [String],
    deploymentMap: Schema.Types.Mixed,
  },
  
  // Error Tracking
  error: {
    message: String,
    timestamp: Date,
    peerId: String,
    stackTrace: String,
  },
  
  // Cost Tracking
  costInfo: {
    estimatedCostUSD: Number,
    creditsCost: Number,
    pricingModel: String,
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    apiVersion: String,
    notes: String,
    tags: [String],
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries (compound indexes only - single field indexes defined in schema)
BatchInferenceTaskSchema.index({ userId: 1, status: 1 });
BatchInferenceTaskSchema.index({ clerkUserId: 1, createdAt: -1 });
BatchInferenceTaskSchema.index({ modelName: 1, status: 1 });
BatchInferenceTaskSchema.index({ status: 1, queuedAt: -1 });

// Virtual for calculating duration in real-time
BatchInferenceTaskSchema.virtual('currentDurationMs').get(function() {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || new Date();
  return endTime.getTime() - this.startedAt.getTime();
});

export default mongoose.models.BatchInferenceTask || 
  mongoose.model<IBatchInferenceTask>('BatchInferenceTask', BatchInferenceTaskSchema);

