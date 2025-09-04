import mongoose, { Document, Schema } from 'mongoose';
import { EncryptedData } from '../encryption';

export interface IConversation extends Document {
  _id: string;
  userId: string; // Clerk user ID
  userIdHash: string; // Hashed user ID for indexing
  title: EncryptedData; // Encrypted conversation title
  modelId: string; // Model used for this conversation
  createdAt: Date;
  updatedAt: Date;
  messageCount: number; // Track number of messages for pagination
  lastMessageAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userIdHash: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    data: { type: String, required: true },
  },
  modelId: {
    type: String,
    required: true,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient user queries
ConversationSchema.index({ userId: 1, createdAt: -1 });
ConversationSchema.index({ userIdHash: 1, lastMessageAt: -1 });

export default mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);