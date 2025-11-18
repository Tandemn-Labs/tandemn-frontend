import mongoose, { Document, Schema } from 'mongoose';

export interface ICLISession extends Document {
  _id: string;
  sessionToken: string; // JWT token hash for quick lookup
  apiKeyId: string; // Reference to UserAPIKey _id
  userId: string; // MongoDB UserAccount _id
  clerkUserId: string; // Clerk user ID for easy reference
  selectedCluster: string; // Selected cluster (e.g., 'Tandemn', 'HAL', 'DELTA')
  expiresAt: Date; // Session expiration timestamp
  createdAt: Date;
  updatedAt: Date;
}

const CLISessionSchema = new Schema<ICLISession>({
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  apiKeyId: {
    type: String,
    required: true,
    index: true,
  },
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
  selectedCluster: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Index for efficient cleanup of expired sessions
CLISessionSchema.index({ expiresAt: 1 });

// Compound index for user's active sessions
CLISessionSchema.index({ userId: 1, expiresAt: 1 });

export default mongoose.models.CLISession || mongoose.model<ICLISession>('CLISession', CLISessionSchema);

