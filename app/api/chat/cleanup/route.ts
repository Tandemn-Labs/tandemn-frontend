import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConversationService } from '@/lib/services/conversationService';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log(`🧹 Starting manual cleanup for user ${userId}`);
    
    const result = await ConversationService.cleanupAllInvalidConversations(userId);
    
    return NextResponse.json({
      message: `Cleanup completed. Removed ${result.cleaned} invalid conversations out of ${result.total} total conversations.`,
      cleaned: result.cleaned,
      total: result.total,
      success: true
    });
    
  } catch (error) {
    console.error('Error in POST /api/chat/cleanup:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup conversations',
        success: false
      },
      { status: 500 }
    );
  }
}