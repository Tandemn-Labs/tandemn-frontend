import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/mock/db';
import { createRoomSchema } from '@/lib/zod-schemas';
import { sleep } from '@/lib/utils';
import { ConversationService } from '@/lib/services/conversationService';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    await sleep(100);
    
    // Use MongoDB instead of mock DB
    const conversations = await ConversationService.getUserConversations(userId);
    
    // Transform to match expected room format
    const rooms = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      modelId: conv.modelId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      userId: userId,
    }));
    
    return NextResponse.json({ items: rooms });
  } catch (error) {
    console.error('Error in GET /api/chat/rooms:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { title, modelId } = createRoomSchema.parse(body);
    
    // Generate title if not provided
    const roomTitle = title || `Chat with ${db.getModelById(modelId)?.name || 'Model'}`;
    
    // Create conversation in MongoDB with encryption
    const conversation = await ConversationService.createConversation(
      userId,
      roomTitle,
      modelId
    );
    
    // Transform to match expected room format
    const room = {
      id: conversation.id,
      title: conversation.title,
      modelId: conversation.modelId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      userId: userId,
    };
    
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/chat/rooms:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
