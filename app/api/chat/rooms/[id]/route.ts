import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/mock/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const finalUserId = userId || 'anonymous';
    
    const { id } = await params;
    const roomId = id;
    const success = db.deleteRoom(finalUserId, roomId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Room not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/chat/rooms/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
