import mongoose, { Document, Schema } from 'mongoose';

export interface IUserAPIKey extends Document {
  _id: string;
  userId: string; // MongoDB UserAccount _id
  clerkUserId: string; // Clerk user ID for easy reference
  name: string;
  keyHash: string; // Store hash, not plain text for security
  keyPrefix: string; // First 8 characters for identification
  isActive: boolean;
  lastUsed?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserAPIKeySchema = new Schema<IUserAPIKey>({
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
  name: {
    type: String,
    required: true,
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  keyPrefix: {
    type: String,
    required: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true,
  },
  lastUsed: {
    type: Date,
    index: true,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries (compound indexes only - single field indexes defined in schema)
UserAPIKeySchema.index({ userId: 1, isActive: 1 });
UserAPIKeySchema.index({ clerkUserId: 1, isActive: 1 });
UserAPIKeySchema.index({ createdAt: -1 });

export default mongoose.models.UserAPIKey || mongoose.model<IUserAPIKey>('UserAPIKey', UserAPIKeySchema);
