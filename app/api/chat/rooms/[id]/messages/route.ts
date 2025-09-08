import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConversationService } from '@/lib/services/conversationService';

// API route to get messages for a specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const conversationId = id;
    
    // Get messages from MongoDB with decryption and user access control
    const messages = await ConversationService.getMessages(conversationId, userId);
    
    // Transform to match expected message format
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      roomId: conversationId,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      backend: msg.metadata?.backend,
    }));
    
    return NextResponse.json({ items: transformedMessages });
  } catch (error) {
    console.error('Error in GET /api/chat/rooms/[id]/messages:', error);
    
    if (error instanceof Error && error.message.includes('access denied')) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}