import dbConnect from '../database';
import Conversation, { IConversation } from '../models/Conversation';
import Message, { IMessage } from '../models/Message';
import { encryptForUser, decryptForUser, hashForIndex } from '../encryption';

export interface ConversationData {
  id: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt: string;
}

export interface MessageData {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  metadata?: {
    backend?: 'tandemn' | 'openrouter' | 'mock';
    processingTime?: number;
    temperature?: number;
    maxTokens?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export class ConversationService {
  /**
   * Create a new conversation for a user
   */
  static async createConversation(
    userId: string,
    title: string,
    modelId: string
  ): Promise<ConversationData> {
    await dbConnect();

    const encryptedTitle = encryptForUser(title, userId);
    const userIdHash = hashForIndex(userId);

    const conversation = new Conversation({
      userId,
      userIdHash,
      title: encryptedTitle,
      modelId,
    });

    await conversation.save();

    return {
      id: conversation._id.toString(),
      title,
      modelId: conversation.modelId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    };
  }

  /**
   * Get all conversations for a user (decrypted)
   */
  static async getUserConversations(userId: string): Promise<ConversationData[]> {
    await dbConnect();

    const conversations = await Conversation.find({ userId })
      .sort({ lastMessageAt: -1 })
      .limit(50);

    return conversations.map(conv => ({
      id: conv._id.toString(),
      title: decryptForUser(conv.title, userId),
      modelId: conv.modelId,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messageCount: conv.messageCount,
      lastMessageAt: conv.lastMessageAt.toISOString(),
    }));
  }

  /**
   * Get a specific conversation (with access control)
   */
  static async getConversation(conversationId: string, userId: string): Promise<ConversationData | null> {
    await dbConnect();

    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) return null;

    return {
      id: conversation._id.toString(),
      title: decryptForUser(conversation.title, userId),
      modelId: conversation.modelId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    };
  }

  /**
   * Add a message to a conversation
   */
  static async addMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    modelId?: string,
    tokenUsage?: MessageData['tokenUsage'],
    metadata?: MessageData['metadata']
  ): Promise<MessageData> {
    await dbConnect();

    // Verify user owns the conversation
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    const encryptedContent = encryptForUser(content, userId);
    const userIdHash = hashForIndex(userId);

    const message = new Message({
      conversationId,
      userId,
      userIdHash,
      role,
      content: encryptedContent,
      modelId,
      tokenUsage,
      metadata,
    });

    await message.save();

    // Update conversation stats
    await Conversation.findByIdAndUpdate(conversationId, {
      $inc: { messageCount: 1 },
      $set: { lastMessageAt: new Date() },
    });

    return {
      id: message._id.toString(),
      conversationId,
      role,
      content,
      modelId,
      tokenUsage,
      metadata,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }

  /**
   * Get messages for a conversation (with access control and decryption)
   */
  static async getMessages(conversationId: string, userId: string, limit = 100): Promise<MessageData[]> {
    await dbConnect();

    // Verify user owns the conversation
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    const messages = await Message.find({ conversationId, userId })
      .sort({ createdAt: 1 })
      .limit(limit);

    return messages.map(msg => ({
      id: msg._id.toString(),
      conversationId: msg.conversationId,
      role: msg.role,
      content: decryptForUser(msg.content, userId),
      modelId: msg.modelId,
      tokenUsage: msg.tokenUsage,
      metadata: msg.metadata,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
    }));
  }

  /**
   * Delete a conversation and all its messages (with access control)
   */
  static async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    await dbConnect();

    // Verify user owns the conversation
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      return false;
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversationId, userId });

    // Delete the conversation
    await Conversation.findOneAndDelete({ _id: conversationId, userId });

    return true;
  }

  /**
   * Update conversation title
   */
  static async updateConversationTitle(
    conversationId: string,
    userId: string,
    newTitle: string
  ): Promise<boolean> {
    await dbConnect();

    const encryptedTitle = encryptForUser(newTitle, userId);

    const result = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { title: encryptedTitle },
      { new: true }
    );

    return !!result;
  }
}