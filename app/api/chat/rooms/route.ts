import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/mock/db';
import { createRoomSchema } from '@/lib/zod-schemas';
import { sleep } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const finalUserId = userId || 'anonymous';
    
    await sleep(100);
    
    const rooms = db.getUserRooms(finalUserId);
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
    const finalUserId = userId || 'anonymous';
    
    const body = await request.json();
    const { title, modelId } = createRoomSchema.parse(body);
    
    // Generate title if not provided
    const roomTitle = title || `Chat with ${db.getModelById(modelId)?.name || 'Model'}`;
    
    const room = db.createRoom(finalUserId, {
      title: roomTitle,
      modelId,
    });
    
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/chat/rooms:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
