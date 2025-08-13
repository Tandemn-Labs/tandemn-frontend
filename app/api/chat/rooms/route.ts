import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/mock/db';
import { createRoomSchema } from '@/lib/zod-schemas';
import { sleep } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
    await sleep(100);
    
    const rooms = db.getUserRooms(userId);
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
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
    const body = await request.json();
    const { title, modelId } = createRoomSchema.parse(body);
    
    // Generate title if not provided
    const roomTitle = title || `Chat with ${db.getModelById(modelId)?.name || 'Model'}`;
    
    const room = db.createRoom(userId, {
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
